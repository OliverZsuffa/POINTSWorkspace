import type {
  Ball, Beat, NotationAction, NotationEntry, ObjectLocation, Performer, PositionDefinition,
  Sequence, SequenceDecodeResult, SeatAssignment, TableLayout,
} from '../../domain/model';
import type { SequenceCodec } from '../../contracts';
import type { LinkId } from '../../domain/ids';
import {
  asActionEntryId, asBallId, asBeatId, asLinkId, asPerformerId, asPositionId,
  asSequenceId,
} from '../../domain/ids';

const MAX_CODE_LENGTH = 1_000_000;
const MAX_ITEMS = 100_000;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ACTION_CODES: Record<NotationAction['type'], string> = {
  HOLD: 'H', LIFT: 'L', LEAVE: 'V', BOUNCE: 'B', TAP: 'T', EMPTY: 'E', ZIP: 'Z', SPECIAL: 'S',
};
type Cursor = { at: number };

function u(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid unsigned integer.');
  if (value < 26) return ALPHABET[value]!;
  const adjusted = value - 26;
  return String(Math.floor(adjusted / 26)) + ALPHABET[adjusted % 26]!;
}
function ru(input: string, cursor: Cursor): number {
  const first = input[cursor.at];
  if (!first) throw new Error('Unexpected end of code.');
  if (/[A-Z]/.test(first)) {
    cursor.at += 1;
    return ALPHABET.indexOf(first);
  }
  const start = cursor.at;
  while (/[0-9]/.test(input[cursor.at] ?? '')) cursor.at += 1;
  const prefix = input.slice(start, cursor.at);
  const terminal = input[cursor.at];
  if (!prefix || !terminal || !/[A-Z]/.test(terminal) || (prefix.length > 1 && prefix[0] === '0')) {
    throw new Error('Invalid integer token.');
  }
  cursor.at += 1;
  const value = Number(prefix) * 26 + ALPHABET.indexOf(terminal) + 26;
  if (!Number.isSafeInteger(value)) throw new Error('Integer exceeds safe range.');
  return value;
}
function tx(value: string): string {
  const bytes = new TextEncoder().encode(value);
  if (bytes.length === 1 && /^[A-Za-z0-9]$/.test(value) && value !== 't') return value;
  let body = '';
  for (const byte of bytes) {
    const char = String.fromCharCode(byte);
    body += /^[A-Za-z0-9]$/.test(char) ? char : '~' + byte.toString(16).toUpperCase().padStart(2, '0');
  }
  return 't' + u(bytes.length) + body;
}
function rtx(input: string, cursor: Cursor): string {
  const first = input[cursor.at];
  if (!first) throw new Error('Missing text value.');
  if (first !== 't') {
    if (!/^[A-Za-z0-9]$/.test(first)) throw new Error('Invalid short text value.');
    cursor.at += 1;
    return first;
  }
  cursor.at += 1;
  const length = ru(input, cursor);
  if (length > MAX_CODE_LENGTH) throw new Error('Text exceeds decoder limit.');
  const bytes: number[] = [];
  while (bytes.length < length) {
    const char = input[cursor.at++];
    if (!char) throw new Error('Truncated text value.');
    if (char === '~') {
      const hex = input.slice(cursor.at, cursor.at + 2);
      if (!/^[0-9A-F]{2}$/.test(hex)) throw new Error('Invalid text escape.');
      bytes.push(parseInt(hex, 16));
      cursor.at += 2;
    } else {
      if (!/^[A-Za-z0-9]$/.test(char)) throw new Error('Invalid text byte.');
      bytes.push(char.charCodeAt(0));
    }
  }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes)); }
  catch { throw new Error('Invalid UTF8 text.'); }
}
function num(value: number): string {
  if (!Number.isFinite(value)) throw new Error('Sequence numbers must be finite.');
  return tx(Object.is(value, -0) ? '-0' : String(value));
}
function rnum(input: string, cursor: Cursor, label: string): number {
  const raw = rtx(input, cursor);
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(raw)) throw new Error('Invalid ' + label + '.');
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error('Invalid ' + label + '.');
  return value;
}
function rat(value: { numerator: number; denominator: number }): string {
  if (!Number.isSafeInteger(value.numerator) || !Number.isSafeInteger(value.denominator) || value.denominator <= 0) {
    throw new Error('Invalid rational value.');
  }
  if (value.numerator === 0 && value.denominator === 1) return '0';
  return (value.numerator < 0 ? 'n' : 'p') + u(Math.abs(value.numerator)) + u(value.denominator);
}
function rrat(input: string, cursor: Cursor): { numerator: number; denominator: number } {
  const sign = input[cursor.at++];
  if (sign === '0') return { numerator: 0, denominator: 1 };
  if (sign !== 'p' && sign !== 'n') throw new Error('Invalid rational value.');
  const magnitude = ru(input, cursor);
  const denominator = ru(input, cursor);
  if (!denominator) throw new Error('Rational denominator must be positive.');
  return { numerator: sign === 'n' ? -magnitude : magnitude, denominator };
}
function idx<T extends { readonly id: string }>(items: readonly T[], id: string): number {
  const value = items.findIndex((item) => item.id === id);
  if (value < 0) throw new Error('Unknown sequence reference: ' + id);
  return value;
}
function hc(hand: 'left' | 'right'): string { return hand === 'left' ? 'L' : 'R'; }
function rh(input: string, cursor: Cursor): 'left' | 'right' {
  const value = input[cursor.at++];
  if (value === 'L') return 'left';
  if (value === 'R') return 'right';
  throw new Error('Invalid hand.');
}
function targetOut(target: Extract<NotationAction, { type: 'LIFT' | 'LEAVE' | 'BOUNCE' | 'TAP' }>['target'], sequence: Sequence): string {
  if (target.kind === 'position') return 'p' + u(idx(sequence.positions, target.positionId));
  if (target.kind === 'circle-position') {
    return 'c' + target.position + (target.direction === undefined ? '0' : target.direction === 'left' ? '1' : '2') +
      (target.distance === undefined ? '0' : '1' + num(target.distance));
  }
  if (target.kind === 'pass-source') return 's' + u(idx(sequence.performers, target.performerId));
  return 'r' + u(idx(sequence.performers, target.performerId)) + hc(target.hand);
}
function targetIn(input: string, cursor: Cursor, positions: PositionDefinition[], performers: Performer[]) {
  const tag = input[cursor.at++];
  if (tag === 'p') {
    const value = positions[ru(input, cursor)];
    if (!value) throw new Error('Unknown position target.');
    return { kind: 'position' as const, positionId: value.id };
  }
  if (tag === 'c') {
    const position = input[cursor.at++] as 'A' | 'B' | 'C';
    if (!['A', 'B', 'C'].includes(position)) throw new Error('Invalid circle position.');
    const direction = input[cursor.at++];
    if (!['0', '1', '2'].includes(direction ?? '')) throw new Error('Invalid circle direction.');
    const hasDistance = input[cursor.at++];
    if (hasDistance !== '0' && hasDistance !== '1') throw new Error('Invalid circle distance marker.');
    return {
      kind: 'circle-position' as const, position,
      ...(direction === '0' ? {} : { direction: direction === '1' ? 'left' as const : 'right' as const }),
      ...(hasDistance === '1' ? { distance: rnum(input, cursor, 'circle distance') } : {}),
    };
  }
  if (tag === 's') {
    const person = performers[ru(input, cursor)];
    if (!person) throw new Error('Unknown pass source.');
    return { kind: 'pass-source' as const, performerId: person.id };
  }
  if (tag === 'r') {
    const person = performers[ru(input, cursor)];
    if (!person) throw new Error('Unknown pass recipient.');
    return { kind: 'pass-recipient-hand' as const, performerId: person.id, hand: rh(input, cursor) };
  }
  throw new Error('Unknown target type.');
}
function linkOut(id: LinkId | undefined, linkIndex: (id: LinkId) => number): string {
  return id === undefined ? '0' : '1' + u(linkIndex(id));
}
function actionOut(action: NotationAction, sequence: Sequence, linkIndex: (id: LinkId) => number): string {
  switch (action.type) {
    case 'HOLD':
    case 'EMPTY': return ACTION_CODES[action.type];
    case 'LIFT':
    case 'LEAVE': return ACTION_CODES[action.type] + targetOut(action.target, sequence) + linkOut(action.linkId, linkIndex);
    case 'BOUNCE':
    case 'TAP': return ACTION_CODES[action.type] + targetOut(action.target, sequence);
    case 'ZIP': return 'Z' + (action.role === 'source' ? 'S' : 'R') + u(linkIndex(action.linkId));
    case 'SPECIAL': return 'S' + tx(action.text) + linkOut(action.linkId, linkIndex);
  }
}
function linkIn(input: string, cursor: Cursor): number | undefined {
  const marker = input[cursor.at++];
  if (marker === '0') return undefined;
  if (marker !== '1') throw new Error('Invalid link marker.');
  return ru(input, cursor);
}
function actionIn(input: string, cursor: Cursor, positions: PositionDefinition[], performers: Performer[]): { action: NotationAction; links: number[] } {
  const type = input[cursor.at++];
  switch (type) {
    case 'H': return { action: { type: 'HOLD' }, links: [] };
    case 'E': return { action: { type: 'EMPTY' }, links: [] };
    case 'L': {
      const target = targetIn(input, cursor, positions, performers);
      if (target.kind === 'pass-recipient-hand') throw new Error('Invalid LIFT target.');
      const link = linkIn(input, cursor);
      return { action: { type: 'LIFT', target, ...(link === undefined ? {} : { linkId: asLinkId('l' + link) }) }, links: link === undefined ? [] : [link] };
    }
    case 'V': {
      const target = targetIn(input, cursor, positions, performers);
      if (target.kind === 'pass-source') throw new Error('Invalid LEAVE target.');
      const link = linkIn(input, cursor);
      return { action: { type: 'LEAVE', target, ...(link === undefined ? {} : { linkId: asLinkId('l' + link) }) }, links: link === undefined ? [] : [link] };
    }
    case 'B':
    case 'T': {
      const target = targetIn(input, cursor, positions, performers);
      if (target.kind !== 'position' && target.kind !== 'circle-position') throw new Error('Invalid tap target.');
      return { action: type === 'B' ? { type: 'BOUNCE', target } : { type: 'TAP', target }, links: [] };
    }
    case 'Z': {
      const role = input[cursor.at++];
      if (role !== 'S' && role !== 'R') throw new Error('Invalid ZIP role.');
      const link = ru(input, cursor);
      return { action: { type: 'ZIP', role: role === 'S' ? 'source' : 'receiver', linkId: asLinkId('l' + link) }, links: [link] };
    }
    case 'S': {
      const value = rtx(input, cursor);
      const link = linkIn(input, cursor);
      return { action: { type: 'SPECIAL', text: value, ...(link === undefined ? {} : { linkId: asLinkId('l' + link) }) }, links: link === undefined ? [] : [link] };
    }
    default: throw new Error('Unknown action code.');
  }
}
function locationOut(value: ObjectLocation, sequence: Sequence): string {
  if (value.kind === 'position') return 'P' + u(idx(sequence.positions, value.positionId));
  if (value.kind === 'hand-held') return 'H' + u(idx(sequence.performers, value.performerId)) + hc(value.hand);
  return 'B' + u(idx(sequence.positions, value.positionId)) + u(idx(sequence.performers, value.performerId)) + hc(value.hand);
}
function locationIn(input: string, cursor: Cursor, positions: PositionDefinition[], performers: Performer[]): ObjectLocation {
  const tag = input[cursor.at++];
  if (tag === 'P') {
    const position = positions[ru(input, cursor)];
    if (!position) throw new Error('Unknown placement position.');
    return { kind: 'position', positionId: position.id };
  }
  if (tag === 'H') {
    const person = performers[ru(input, cursor)];
    if (!person) throw new Error('Unknown held performer.');
    return { kind: 'hand-held', performerId: person.id, hand: rh(input, cursor) };
  }
  if (tag === 'B') {
    const position = positions[ru(input, cursor)];
    const person = performers[ru(input, cursor)];
    if (!position || !person) throw new Error('Unknown hand back placement reference.');
    return { kind: 'hand-back', positionId: position.id, performerId: person.id, hand: rh(input, cursor) };
  }
  throw new Error('Unknown placement type.');
}
function seatSideCode(side: 'long-a' | 'long-b' | 'short-a' | 'short-b'): string {
  return String(['long-a', 'long-b', 'short-a', 'short-b'].indexOf(side));
}
function readSeatSide(value: string): 'long-a' | 'long-b' | 'short-a' | 'short-b' {
  const sides = ['long-a', 'long-b', 'short-a', 'short-b'] as const;
  const side = sides[Number(value)];
  if (!side || !/^[0-3]$/.test(value)) throw new Error('Invalid rectangle side.');
  return side;
}

export const sequenceCodec: SequenceCodec = {
  encode(sequence) {
    const counts = [sequence.timeSignature.beatGrouping.length, sequence.beats.length, sequence.performers.length, sequence.positions.length, sequence.balls.length, sequence.initialState.placements.length, sequence.seatAssignments.length, sequence.notation.length];
    if (counts.some((count) => count > MAX_ITEMS)) throw new Error('Sequence exceeds codec item limits.');
    sequence.notation.forEach((entry) => {
      idx(sequence.performers, entry.performerId);
      idx(sequence.beats, entry.time.beatId);
    });
    const links = [...new Set(sequence.notation.flatMap(({ action }) =>
      'linkId' in action && action.linkId !== undefined ? [action.linkId] : [],
    ))];
    const li = (id: LinkId) => {
      const value = links.indexOf(id);
      if (value < 0) throw new Error('Unknown link reference.');
      return value;
    };
    let out = 'P5' + (sequence.sequenceType === 'solo' ? 'S' : sequence.sequenceType === 'circle-passing' ? 'C' : 'I');
    out += num(sequence.bpm) + num(sequence.timeSignature.numerator) + num(sequence.timeSignature.denominator);
    out += u(sequence.timeSignature.beatGrouping.length);
    sequence.timeSignature.beatGrouping.forEach((value) => { out += num(value); });
    out += u(sequence.beats.length) + u(sequence.performers.length);
    sequence.performers.forEach((person) => {
      out += tx(person.name) + (person.identifier === undefined ? '0' : '1' + tx(person.identifier));
    });
    out += u(sequence.positions.length);
    sequence.positions.forEach((position) => {
      if (position.kind === 'table') {
        out += 'T' + tx(position.name) + (position.owner.kind === 'shared' ? 'S' : 'P' + u(idx(sequence.performers, position.owner.performerId)));
      } else {
        out += 'B' + position.name + u(idx(sequence.performers, position.performerId)) + hc(position.hand);
      }
    });
    out += u(sequence.balls.length) + u(sequence.initialState.placements.length);
    sequence.initialState.placements.forEach((placement) => {
      out += u(idx(sequence.balls, placement.ballId)) + locationOut(placement.location, sequence);
    });
    sequence.beats.forEach((beat) => { out += beat.durationKind === 'half' ? 'H' : 'R'; });
    out += sequence.individualPassingLayout === undefined ? 'N'
      : sequence.individualPassingLayout === 'shared-positions' ? 'S' : 'P';
    const layout = sequence.tableLayout;
    out += layout.type === 'solo' ? 'S'
      : layout.type === 'polygon' ? 'P' + num(layout.sideCount)
        : 'R' + num(layout.longSideSeatCount) + num(layout.shortSideSeatCount);
    out += u(sequence.seatAssignments.length);
    sequence.seatAssignments.forEach((assignment) => {
      out += u(idx(sequence.performers, assignment.performerId));
      out += assignment.seat.kind === 'polygon-edge'
        ? 'P' + num(assignment.seat.edgeIndex)
        : 'R' + seatSideCode(assignment.seat.side) + num(assignment.seat.seatIndex);
    });
    out += '.';
    sequence.performers.forEach((person) => {
      (['left', 'right'] as const).forEach((hand) => {
        const cells = sequence.beats.map((beat) => sequence.notation
          .map((entry, ordinal) => ({ entry, ordinal }))
          .filter(({ entry }) => entry.performerId === person.id && entry.hand === hand && entry.time.beatId === beat.id));
        for (let i = 0; i < cells.length;) {
          if (cells[i]!.length === 0) {
            let end = i + 1;
            while (end < cells.length && cells[end]!.length === 0) end += 1;
            const count = end - i;
            out += count > 1 ? 'e' + u(count) : 'A';
            i = end;
          } else {
            out += u(cells[i]!.length);
            cells[i]!.forEach(({ entry, ordinal }) => {
              out += u(ordinal) + rat(entry.time.offset) + actionOut(entry.action, sequence, li);
            });
            i += 1;
          }
        }
      });
    });
    if (out.length > MAX_CODE_LENGTH) throw new Error('Sequence code exceeds the maximum supported length.');
    return out;
  },

  decode(code): SequenceDecodeResult {
    if (!code.startsWith('P')) return { ok: false, code: 'malformed', message: 'This is not a POINTS sequence code.' };
    if (!code.startsWith('P5')) return { ok: false, code: 'unsupported-version', message: 'This sequence code uses a superseded or unsupported format.' };
    try {
      if (code.length > MAX_CODE_LENGTH) throw new Error('Sequence code exceeds the maximum supported length.');
      if (/\s/.test(code)) throw new Error('Whitespace is not permitted in a sequence code.');
      const cursor: Cursor = { at: 2 };
      const type = code[cursor.at++];
      const sequenceType = type === 'S' ? 'solo' : type === 'C' ? 'circle-passing' : type === 'I' ? 'individual-passing' : null;
      if (!sequenceType) throw new Error('Invalid sequence type.');
      const bpm = rnum(code, cursor, 'BPM');
      const numerator = rnum(code, cursor, 'time signature numerator');
      const denominator = rnum(code, cursor, 'time signature denominator') as Sequence['timeSignature']['denominator'];
      const groupCount = ru(code, cursor);
      if (groupCount > MAX_ITEMS) throw new Error('Too many time signature groups.');
      const beatGrouping = Array.from({ length: groupCount }, () => rnum(code, cursor, 'beat grouping'));
      const beatCount = ru(code, cursor);
      const performerCount = ru(code, cursor);
      if (beatCount > MAX_ITEMS || performerCount > MAX_ITEMS) throw new Error('Sequence exceeds decoder limits.');
      const performers: Performer[] = Array.from({ length: performerCount }, (_, index) => {
        const name = rtx(code, cursor);
        const marker = code[cursor.at++];
        if (marker !== '0' && marker !== '1') throw new Error('Invalid performer identifier marker.');
        return { id: asPerformerId('p' + index), name, ...(marker === '1' ? { identifier: rtx(code, cursor) } : {}) };
      });
      const positionCount = ru(code, cursor);
      if (positionCount > MAX_ITEMS) throw new Error('Too many positions.');
      const positions: PositionDefinition[] = Array.from({ length: positionCount }, (_, index) => {
        const tag = code[cursor.at++];
        if (tag === 'T') {
          const name = rtx(code, cursor);
          const owner = code[cursor.at++];
          if (owner === 'S') return { id: asPositionId('x' + index), kind: 'table', name, owner: { kind: 'shared' } };
          if (owner === 'P') {
            const person = performers[ru(code, cursor)];
            if (!person) throw new Error('Unknown position owner.');
            return { id: asPositionId('x' + index), kind: 'table', name, owner: { kind: 'performer', performerId: person.id } };
          }
          throw new Error('Invalid position owner.');
        }
        if (tag === 'B') {
          const name = code[cursor.at++];
          const person = performers[ru(code, cursor)];
          const hand = rh(code, cursor);
          if ((name !== 'L' && name !== 'R') || !person) throw new Error('Invalid hand back position.');
          return { id: asPositionId('x' + index), kind: 'hand-back', name, performerId: person.id, hand };
        }
        throw new Error('Invalid position definition.');
      });
      const ballCount = ru(code, cursor);
      const placementCount = ru(code, cursor);
      if (ballCount > MAX_ITEMS || placementCount > MAX_ITEMS) throw new Error('Too many objects or placements.');
      const balls: Ball[] = Array.from({ length: ballCount }, (_, index) => ({ id: asBallId('o' + index) }));
      const placements = Array.from({ length: placementCount }, () => {
        const ball = balls[ru(code, cursor)];
        if (!ball) throw new Error('Unknown placed object.');
        return { ballId: ball.id, location: locationIn(code, cursor, positions, performers) };
      });
      const beats: Beat[] = Array.from({ length: beatCount }, (_, index) => {
        const durationCode = code[cursor.at++];
        if (durationCode !== 'R' && durationCode !== 'H') throw new Error('Invalid beat duration kind.');
        return { id: asBeatId('b' + index), durationKind: durationCode === 'H' ? 'half' : 'regular' };
      });
      const passingCode = code[cursor.at++];
      const individualPassingLayout = passingCode === 'N' ? undefined
        : passingCode === 'S' ? 'shared-positions' : passingCode === 'P' ? 'per-performer-positions' : null;
      if (individualPassingLayout === null) throw new Error('Invalid individual passing layout.');
      const tableCode = code[cursor.at++];
      let tableLayout: TableLayout;
      if (tableCode === 'S') tableLayout = { type: 'solo' };
      else if (tableCode === 'P') tableLayout = { type: 'polygon', sideCount: rnum(code, cursor, 'table side count') };
      else if (tableCode === 'R') tableLayout = {
        type: 'rectangle',
        longSideSeatCount: rnum(code, cursor, 'long side seat count'),
        shortSideSeatCount: rnum(code, cursor, 'short side seat count'),
      };
      else throw new Error('Invalid table layout.');
      const seatCount = ru(code, cursor);
      if (seatCount > MAX_ITEMS) throw new Error('Too many seat assignments.');
      const seatAssignments: SeatAssignment[] = Array.from({ length: seatCount }, () => {
        const person = performers[ru(code, cursor)];
        const tag = code[cursor.at++];
        if (!person) throw new Error('Unknown seat performer.');
        if (tag === 'P') return { performerId: person.id, seat: { kind: 'polygon-edge', edgeIndex: rnum(code, cursor, 'polygon edge') } };
        if (tag === 'R') {
          const side = readSeatSide(code[cursor.at++] ?? '');
          return { performerId: person.id, seat: { kind: 'rectangle-side', side, seatIndex: rnum(code, cursor, 'seat index') } };
        }
        throw new Error('Invalid seat assignment.');
      });
      if (code[cursor.at++] !== '.') throw new Error('Missing metadata separator.');
      const raw: { ordinal: number; performer: number; hand: 'left' | 'right'; beat: number; offset: { numerator: number; denominator: number }; action: NotationAction }[] = [];
      const linkRefs = new Set<number>();
      for (let performer = 0; performer < performerCount; performer += 1) {
        for (const hand of ['left', 'right'] as const) {
          let beat = 0;
          while (beat < beatCount) {
            const marker = code[cursor.at];
            if (marker === 'e') {
              cursor.at += 1;
              const count = ru(code, cursor);
              if (count < 2 || beat + count > beatCount) throw new Error('Invalid empty beat run.');
              beat += count;
              continue;
            }
            const eventCount = ru(code, cursor);
            if (eventCount > MAX_ITEMS) throw new Error('Too many events in a beat.');
            for (let event = 0; event < eventCount; event += 1) {
              const ordinal = ru(code, cursor);
              const offset = rrat(code, cursor);
              const decoded = actionIn(code, cursor, positions, performers);
              decoded.links.forEach((link) => linkRefs.add(link));
              if (raw.length >= MAX_ITEMS) throw new Error('Too many notation events.');
              raw.push({ ordinal, performer, hand, beat, offset, action: decoded.action });
            }
            beat += 1;
          }
        }
      }
      if (cursor.at !== code.length) throw new Error('Unexpected trailing data.');
      raw.sort((a, b) => a.ordinal - b.ordinal);
      if (raw.some((event, index) => event.ordinal !== index)) throw new Error('Event ordinals must be contiguous.');
      const sortedLinks = [...linkRefs].sort((a, b) => a - b);
      if (sortedLinks.some((value, index) => value !== index)) throw new Error('Link references must be contiguous.');
      const notation: NotationEntry[] = raw.map((event, index) => ({
        id: asActionEntryId('a' + index),
        performerId: performers[event.performer]!.id,
        hand: event.hand,
        time: { beatId: beats[event.beat]!.id, offset: event.offset },
        action: event.action,
      }));
      const sequence: Sequence = {
          id: asSequenceId('sequence-imported'),
          sequenceType,
          timeSignature: { numerator, denominator, beatGrouping },
          bpm,
          beats,
          performers,
          positions,
          balls,
          initialState: { placements },
          notation,
          ...(individualPassingLayout === undefined ? {} : { individualPassingLayout }),
          tableLayout,
          seatAssignments,
      };
      if (sequenceCodec.encode(sequence) !== code) throw new Error('Sequence code is not canonical.');
      return { ok: true, sequence };
    } catch (error) {
      return { ok: false, code: 'invalid-data', message: error instanceof Error ? error.message : 'Invalid sequence code.' };
    }
  },
};
