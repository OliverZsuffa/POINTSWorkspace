import type {
  Ball, Beat, NotationAction, NotationEntry, ObjectLocation, Performer, PositionDefinition, Sequence,
  SequenceDecodeResult, SeatAssignment, TableLayout,
} from '../../domain/model';
import type { SequenceCodec } from '../../contracts';
import type { LinkId } from '../../domain/ids';
import {
  asActionEntryId, asBallId, asBeatId, asLinkId, asPerformerId, asPositionId,
  asSequenceId, asSubdivisionId,
} from '../../domain/ids';

const PREFIX = 'P2.';
type Packed = unknown[];

const ACTION_TO_CODE: Record<NotationAction['type'], string> = {
  HOLD: 'H', LIFT: 'L', LEAVE: 'V', BOUNCE: 'B', TAP: 'T', EMPTY: 'E', ZIP: 'Z', SPECIAL: 'S',
};
const CODE_TO_ACTION = Object.fromEntries(Object.entries(ACTION_TO_CODE).map(([key, value]) => [value, key])) as Record<string, NotationAction['type']>;

function indexOf<T extends { readonly id: string }>(items: readonly T[], id: string): number {
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) throw new Error(`Unknown reference: ${id}`);
  return index;
}
function fraction(value: { numerator: number; denominator: number }): string {
  return value.denominator === 1 ? String(value.numerator) : `${value.numerator}/${value.denominator}`;
}
function parseFraction(value: string): { numerator: number; denominator: number } {
  const [n, d] = value.split('/');
  const numerator = Number(n);
  const denominator = d === undefined ? 1 : Number(d);
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator <= 0) throw new Error('Invalid fraction');
  return { numerator, denominator };
}
function encodeLocation(location: ObjectLocation, sequence: Sequence): Packed {
  if (location.kind === 'position') return ['P', indexOf(sequence.positions, location.positionId)];
  if (location.kind === 'hand-held') return ['H', indexOf(sequence.performers, location.performerId), location.hand === 'left' ? 'L' : 'R'];
  return ['B', indexOf(sequence.positions, location.positionId), indexOf(sequence.performers, location.performerId), location.hand === 'left' ? 'L' : 'R'];
}
function encodeTarget(target: Extract<NotationAction, { type: 'LIFT' | 'LEAVE' | 'BOUNCE' | 'TAP' }>['target'], sequence: Sequence): Packed {
  if (target.kind === 'position') return ['P', indexOf(sequence.positions, target.positionId)];
  if (target.kind === 'circle-position') return ['C', target.position, target.direction === 'left' ? 'L' : target.direction === 'right' ? 'R' : '', target.distance ?? 0];
  if (target.kind === 'pass-source') return ['S', indexOf(sequence.performers, target.performerId)];
  return ['R', indexOf(sequence.performers, target.performerId), target.hand === 'left' ? 'L' : 'R'];
}
function encodeAction(action: NotationAction, sequence: Sequence, linkIndex: (id: LinkId) => number): Packed {
  const code = ACTION_TO_CODE[action.type];
  switch (action.type) {
    case 'HOLD': case 'EMPTY': return [code];
    case 'LIFT': case 'LEAVE': return [code, encodeTarget(action.target, sequence), action.linkId ? linkIndex(action.linkId) : -1];
    case 'BOUNCE': case 'TAP': return [code, encodeTarget(action.target, sequence)];
    case 'ZIP': return [code, action.role === 'source' ? 'S' : 'R', linkIndex(action.linkId)];
    case 'SPECIAL': return [code, action.text, action.linkId ? linkIndex(action.linkId) : -1];
  }
}
function isPacked(value: unknown): value is Packed {
  return Array.isArray(value);
}

function encodePacked(value: unknown): string {
  if (Array.isArray(value)) return `(${value.map(encodePacked).join(',')})`;
  if (typeof value === 'string') {
    if (/^[A-Za-z]$/.test(value)) return value;
    return `~${encodeURIComponent(value).replace(/~/g, '%7E')}`;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  throw new Error('Unsupported packed value');
}

function decodePacked(source: string): unknown {
  let cursor = 0;
  const readValue = (): unknown => {
    if (source[cursor] === '(') {
      cursor += 1;
      const values: unknown[] = [];
      if (source[cursor] === ')') {
        cursor += 1;
        return values;
      }
      while (cursor < source.length) {
        values.push(readValue());
        if (source[cursor] === ',') {
          cursor += 1;
          continue;
        }
        if (source[cursor] === ')') {
          cursor += 1;
          return values;
        }
        throw new Error('Invalid tuple separator');
      }
      throw new Error('Unclosed tuple');
    }
    if (source[cursor] === '~') {
      cursor += 1;
      const start = cursor;
      while (cursor < source.length && source[cursor] !== ',' && source[cursor] !== ')') cursor += 1;
      return decodeURIComponent(source.slice(start, cursor));
    }
    const start = cursor;
    while (cursor < source.length && source[cursor] !== ',' && source[cursor] !== ')') cursor += 1;
    const token = source.slice(start, cursor);
    if (!/^-?(?:0|[1-9]\d*)(?:\\.\d+)?(?:[eE][+-]?\d+)?$/.test(token)) {
      throw new Error('Invalid numeric value');
    }
    const number = Number(token);
    if (!Number.isFinite(number)) throw new Error('Invalid numeric value');
    return number;
  };

  const value = readValue();
  if (cursor !== source.length) throw new Error('Trailing packed data');
  return value;
}
function decodeTarget(value: unknown, positions: PositionDefinition[], performers: Performer[]) {
  if (!isPacked(value)) throw new Error('Invalid action target');
  if (value[0] === 'P') return { kind: 'position' as const, positionId: positions[Number(value[1])]!.id };
  if (value[0] === 'C') return {
    kind: 'circle-position' as const, position: value[1] as 'A' | 'B' | 'C',
    ...(value[2] === 'L' || value[2] === 'R' ? { direction: value[2] === 'L' ? 'left' as const : 'right' as const, distance: Number(value[3]) } : {}),
  };
  if (value[0] === 'S') return { kind: 'pass-source' as const, performerId: performers[Number(value[1])]!.id };
  if (value[0] === 'R') return { kind: 'pass-recipient-hand' as const, performerId: performers[Number(value[1])]!.id, hand: value[2] === 'L' ? 'left' as const : 'right' as const };
  throw new Error('Unknown target kind');
}
function decodeAction(value: unknown, positions: PositionDefinition[], performers: Performer[], links: LinkId[]): NotationAction {
  if (!isPacked(value) || typeof value[0] !== 'string') throw new Error('Invalid action');
  const type = CODE_TO_ACTION[value[0]];
  if (!type) throw new Error('Unknown action code');
  const link = (index: unknown): LinkId | undefined => {
    if (index === -1) return undefined;
    if (typeof index !== 'number' || !Number.isSafeInteger(index) || index < 0 || !links[index]) {
      throw new Error('Invalid link reference');
    }
    return links[index];
  };
  switch (type) {
    case 'HOLD': return { type };
    case 'EMPTY': return { type };
    case 'LIFT': return { type, target: decodeTarget(value[1], positions, performers) as Extract<NotationAction, { type: 'LIFT' }>['target'], ...(link(value[2]) ? { linkId: link(value[2]) } : {}) };
    case 'LEAVE': return { type, target: decodeTarget(value[1], positions, performers) as Extract<NotationAction, { type: 'LEAVE' }>['target'], ...(link(value[2]) ? { linkId: link(value[2]) } : {}) };
    case 'BOUNCE': return { type, target: decodeTarget(value[1], positions, performers) as Extract<NotationAction, { type: 'BOUNCE' }>['target'] };
    case 'TAP': return { type, target: decodeTarget(value[1], positions, performers) as Extract<NotationAction, { type: 'TAP' }>['target'] };
    case 'ZIP': {
      const linkId = link(value[2]);
      if (!linkId || (value[1] !== 'S' && value[1] !== 'R')) throw new Error('Invalid ZIP action');
      return { type, role: value[1] === 'S' ? 'source' : 'receiver', linkId };
    }
    case 'SPECIAL': return { type, text: String(value[1]), ...(link(value[2]) ? { linkId: link(value[2]) } : {}) };
  }
}

export const sequenceCodec: SequenceCodec = {
  encode(sequence) {
    const performer = (id: string) => indexOf(sequence.performers, id);
    const ball = (id: string) => indexOf(sequence.balls, id);
    const beat = (id: string) => indexOf(sequence.beats, id);
    const links = [...new Set(sequence.notation.flatMap((entry) => 'linkId' in entry.action && entry.action.linkId ? [entry.action.linkId] : []))];
    const linkIndex = (id: LinkId) => {
      const index = links.indexOf(id);
      if (index < 0) throw new Error('Unknown link');
      return index;
    };
    const performers: Packed = sequence.performers.map((item) => [item.name, item.identifier ?? '']);
    const positions: Packed = sequence.positions.map((item) => item.kind === 'table'
      ? ['T', item.name, item.owner.kind === 'shared' ? 'S' : 'P', item.owner.kind === 'shared' ? -1 : performer(item.owner.performerId)]
      : ['B', item.name, performer(item.performerId), item.hand === 'left' ? 'L' : 'R']);
    const beats: Packed = sequence.beats.map((item) => item.subdivisions.map((sub) => [fraction(sub.start), fraction(sub.duration), sub.depth]));
    const placements: Packed = sequence.initialState.placements.map((item) => [ball(item.ballId), encodeLocation(item.location, sequence)]);
    const notation: Packed = sequence.notation.map((entry) => [
      performer(entry.performerId), entry.hand === 'left' ? 'L' : 'R', beat(entry.time.beatId),
      fraction(entry.time.offset), encodeAction(entry.action, sequence, linkIndex),
    ]);
    const seats: Packed = sequence.seatAssignments.map((item) => {
      const seat = item.seat;
      return seat.kind === 'polygon-edge'
        ? [performer(item.performerId), 'P', seat.edgeIndex]
        : [performer(item.performerId), 'R', seat.side, seat.seatIndex];
    });
    const layout = sequence.tableLayout.type === 'solo' ? ['S']
      : sequence.tableLayout.type === 'polygon' ? ['P', sequence.tableLayout.sideCount]
        : ['R', sequence.tableLayout.longSideSeatCount, sequence.tableLayout.shortSideSeatCount];
    const packed: Packed = [
      sequence.sequenceType === 'solo' ? 's' : sequence.sequenceType === 'circle-passing' ? 'c' : 'i',
      sequence.bpm,
      [sequence.timeSignature.numerator, sequence.timeSignature.denominator, sequence.timeSignature.beatGrouping],
      performers, positions, sequence.balls.length, placements, beats, notation,
      sequence.individualPassingLayout === 'per-performer-positions' ? 'p' : sequence.individualPassingLayout === 'shared-positions' ? 's' : '',
      layout, seats,
    ];
    // Readable action initials remain visible in the action stream. Tuple keys and UUIDs are omitted.
    return PREFIX + encodePacked(packed);
  },
  decode(code): SequenceDecodeResult {
    const trimmed = code.trim();
    if (!trimmed.startsWith('P')) return { ok: false, code: 'malformed', message: 'This is not a POINTS sequence code.' };
    if (!trimmed.startsWith(PREFIX)) return { ok: false, code: 'unsupported-version', message: 'This sequence code uses an unsupported format version.' };
    try {
      const raw: unknown = decodePacked(trimmed.slice(PREFIX.length));
      if (!isPacked(raw) || raw.length !== 12) throw new Error('Invalid sequence tuple');
      const [kind, bpm, signature, rawPerformers, rawPositions, ballCount, rawPlacements, rawBeats, rawNotation, individualLayout, rawLayout, rawSeats] = raw;
      if (!isPacked(rawPerformers) || !isPacked(rawPositions) || !isPacked(rawPlacements) || !isPacked(rawBeats) || !isPacked(rawNotation) || !isPacked(rawLayout) || !isPacked(rawSeats) || !isPacked(signature)) throw new Error('Invalid sections');
      const performers: Performer[] = rawPerformers.map((item, index) => {
        if (!isPacked(item)) throw new Error('Invalid performer');
        return { id: asPerformerId(`p${index}`), name: String(item[0]), ...(item[1] ? { identifier: String(item[1]) } : {}) };
      });
      const positions: PositionDefinition[] = rawPositions.map((item, index) => {
        if (!isPacked(item)) throw new Error('Invalid position');
        if (item[0] === 'T') return {
          id: asPositionId(`x${index}`), kind: 'table', name: String(item[1]),
          owner: item[2] === 'S' ? { kind: 'shared' } : { kind: 'performer', performerId: performers[Number(item[3])]!.id },
        };
        return { id: asPositionId(`x${index}`), kind: 'hand-back', name: item[1] as 'L' | 'R', performerId: performers[Number(item[2])]!.id, hand: item[3] === 'L' ? 'left' : 'right' };
      });
      const balls: Ball[] = Array.from({ length: Number(ballCount) }, (_, index) => ({ id: asBallId(`b${index}`) }));
      const beats: Beat[] = rawBeats.map((item, index) => {
        if (!isPacked(item)) throw new Error('Invalid beat');
        return { id: asBeatId(`t${index}`), subdivisions: item.map((sub, subIndex) => {
          if (!isPacked(sub)) throw new Error('Invalid subdivision');
          return { id: asSubdivisionId(`t${index}s${subIndex}`), start: parseFraction(String(sub[0])), duration: parseFraction(String(sub[1])), depth: Number(sub[2]) };
        }) };
      });
      const links = [...new Set(rawNotation.flatMap((entry) => isPacked(entry) && isPacked(entry[4]) && typeof entry[4][2] === 'number' && entry[4][2] >= 0 ? [Number(entry[4][2])] : isPacked(entry) && isPacked(entry[4]) && entry[4][0] === 'Z' ? [Number(entry[4][2])] : []))].sort((a, b) => a - b).map((index) => asLinkId(`l${index}`));
      const notation: NotationEntry[] = rawNotation.map((entry, index) => {
        if (!isPacked(entry) || !isPacked(entry[4])) throw new Error('Invalid notation entry');
        const actionRaw = entry[4];
        const action = decodeAction(actionRaw, positions, performers, links);
        return {
          id: asActionEntryId(`a${index}`), performerId: performers[Number(entry[0])]!.id,
          hand: entry[1] === 'L' ? 'left' : 'right',
          time: { beatId: beats[Number(entry[2])]!.id, offset: parseFraction(String(entry[3])) },
          action,
        };
      });
      const placements = rawPlacements.map((item) => {
        if (!isPacked(item) || !isPacked(item[1])) throw new Error('Invalid placement');
        const loc = item[1];
        let location: ObjectLocation;
        if (loc[0] === 'P') location = { kind: 'position', positionId: positions[Number(loc[1])]!.id };
        else if (loc[0] === 'H') location = { kind: 'hand-held', performerId: performers[Number(loc[1])]!.id, hand: loc[2] === 'L' ? 'left' : 'right' };
        else if (loc[0] === 'B') location = { kind: 'hand-back', positionId: positions[Number(loc[1])]!.id, performerId: performers[Number(loc[2])]!.id, hand: loc[3] === 'L' ? 'left' : 'right' };
        else throw new Error('Unknown placement location');
        return { ballId: balls[Number(item[0])]!.id, location };
      });
      const timeSignature = {
        numerator: Number(signature[0]), denominator: Number(signature[1]) as 1 | 2 | 4 | 8 | 16 | 32 | 64,
        beatGrouping: (signature[2] as number[]).map(Number),
      };
      const tableLayout: TableLayout = rawLayout[0] === 'S' ? { type: 'solo' }
        : rawLayout[0] === 'P' ? { type: 'polygon', sideCount: Number(rawLayout[1]) }
          : { type: 'rectangle', longSideSeatCount: Number(rawLayout[1]), shortSideSeatCount: Number(rawLayout[2]) };
      const seatAssignments: SeatAssignment[] = rawSeats.map((item) => {
        if (!isPacked(item)) throw new Error('Invalid seat');
        return { performerId: performers[Number(item[0])]!.id, seat: item[1] === 'P'
          ? { kind: 'polygon-edge', edgeIndex: Number(item[2]) }
          : { kind: 'rectangle-side', side: item[2] as 'long-a' | 'long-b' | 'short-a' | 'short-b', seatIndex: Number(item[3]) } };
      });
      const sequence: Sequence = {
        id: asSequenceId('sequence'), sequenceType: kind === 's' ? 'solo' : kind === 'c' ? 'circle-passing' : 'individual-passing',
        bpm: Number(bpm), timeSignature, performers, positions, balls, beats, notation,
        initialState: { placements }, tableLayout, seatAssignments,
        ...(individualLayout === 'p' ? { individualPassingLayout: 'per-performer-positions' as const } : individualLayout === 's' ? { individualPassingLayout: 'shared-positions' as const } : {}),
      };
      if (!Number.isFinite(sequence.bpm) || sequence.bpm <= 0 || !beats.length || !performers.length || !positions.length || typeof ballCount !== 'number' || !Number.isSafeInteger(ballCount) || ballCount < 0) throw new Error('Invalid sequence values');
      return { ok: true, sequence };
    } catch {
      return { ok: false, code: 'malformed', message: 'The sequence code is damaged or incomplete.' };
    }
  },
};

export function isSequenceCode(value: string): boolean {
  return value.trim().startsWith(PREFIX);
}
