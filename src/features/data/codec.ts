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

const PREFIX = 'P3;';
const SECTION_NAMES = ['S', 'Q', 'T', 'B', 'P', 'X', 'O', 'I', 'D', 'A', 'J', 'M', 'C'] as const;
type SectionName = (typeof SECTION_NAMES)[number];
type Sections = Record<SectionName, string>;

const ACTION_CODES: Record<NotationAction['type'], string> = {
  HOLD: 'H',
  LIFT: 'L',
  LEAVE: 'V',
  BOUNCE: 'B',
  TAP: 'T',
  EMPTY: 'E',
  ZIP: 'Z',
  SPECIAL: 'S',
};

function indexOf<T extends { readonly id: string }>(items: readonly T[], id: string): number {
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) throw new Error(`Unknown sequence reference: ${id}`);
  return index;
}

function numberText(value: number): string {
  if (!Number.isFinite(value)) throw new Error('Sequence numbers must be finite.');
  return Object.is(value, -0) ? '-0' : String(value);
}

function integerText(value: number): string {
  if (!Number.isSafeInteger(value)) throw new Error('Sequence integer is outside the safe integer range.');
  return String(value);
}

function parseNumber(value: string, label: string): number {
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(value)) {
    throw new Error(`Invalid ${label}.`);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label}.`);
  return parsed;
}

function parseInteger(value: string, label: string, minimum = 0): number {
  if (!/^(?:0|[1-9]\d*)$/.test(value)) throw new Error(`Invalid ${label}.`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum) throw new Error(`Invalid ${label}.`);
  return parsed;
}

function encodeText(value: string): string {
  const encoded = encodeURIComponent(value)
    .replace(/\./g, '%2E')
    .replace(/~/g, '%7E');
  return `~${new TextEncoder().encode(value).length}:${encoded}`;
}

function decodeText(value: string): string {
  const match = /^~(0|[1-9]\d*):(.*)$/.exec(value);
  if (!match) throw new Error('Invalid text value.');
  const decoded = decodeURIComponent(match[2]!);
  if (new TextEncoder().encode(decoded).length !== Number(match[1])) {
    throw new Error('Text length does not match its encoded value.');
  }
  return decoded;
}

function encodeRational(value: { numerator: number; denominator: number }): string {
  if (!Number.isSafeInteger(value.numerator) || !Number.isSafeInteger(value.denominator) || value.denominator <= 0) {
    throw new Error('Invalid rational value.');
  }
  return value.denominator === 1
    ? integerText(value.numerator)
    : `${integerText(value.numerator)}/${integerText(value.denominator)}`;
}

function decodeRational(value: string): { numerator: number; denominator: number } {
  const match = /^(-?(?:0|[1-9]\d*))(?:\/([1-9]\d*))?$/.exec(value);
  if (!match) throw new Error('Invalid rational value.');
  const numerator = Number(match[1]);
  const denominator = match[2] === undefined ? 1 : Number(match[2]);
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator)) {
    throw new Error('Rational value is outside the safe integer range.');
  }
  return { numerator, denominator };
}

function records(value: string): string[] {
  return value === '' ? [] : value.split(',');
}

function fields(value: string, count: number, label: string): string[] {
  const result = value.split('.');
  if (result.length !== count) throw new Error(`Invalid ${label}.`);
  return result;
}

function sectionMap(code: string): Sections {
  const parts = code.split(';');
  if (parts[0] !== 'P3' || parts.length !== SECTION_NAMES.length + 1) {
    throw new Error('Invalid P3 document framing.');
  }
  const result = {} as Sections;
  SECTION_NAMES.forEach((name, index) => {
    const part = parts[index + 1]!;
    const separator = part.indexOf(':');
    if (separator !== 1 || part[0] !== name) throw new Error(`Missing or misplaced ${name} section.`);
    result[name] = part.slice(separator + 1);
  });
  return result;
}

function encodeTarget(
  target: Extract<NotationAction, { type: 'LIFT' | 'LEAVE' | 'BOUNCE' | 'TAP' }>['target'],
  sequence: Sequence,
): string {
  if (target.kind === 'position') return `p${indexOf(sequence.positions, target.positionId)}`;
  if (target.kind === 'circle-position') {
    const direction = target.direction === 'left' ? 'L' : target.direction === 'right' ? 'R' : '-';
    const distance = target.distance === undefined ? '-' : numberText(target.distance);
    return `c${target.position}_${direction}_${distance}`;
  }
  if (target.kind === 'pass-source') return `s${indexOf(sequence.performers, target.performerId)}`;
  return `r${indexOf(sequence.performers, target.performerId)}_${target.hand === 'left' ? 'L' : 'R'}`;
}

function encodeActionParts(
  action: NotationAction,
  sequence: Sequence,
  linkIndex: (id: LinkId) => number,
): string[] {
  const code = ACTION_CODES[action.type];
  switch (action.type) {
    case 'HOLD':
    case 'EMPTY':
      return [code];
    case 'LIFT':
    case 'LEAVE':
      return [code, encodeTarget(action.target, sequence), action.linkId === undefined ? '-' : `l${linkIndex(action.linkId)}`];
    case 'BOUNCE':
    case 'TAP':
      return [code, encodeTarget(action.target, sequence)];
    case 'ZIP':
      return [code, action.role === 'source' ? 'S' : 'R', `l${linkIndex(action.linkId)}`];
    case 'SPECIAL':
      return [code, encodeText(action.text), action.linkId === undefined ? '-' : `l${linkIndex(action.linkId)}`];
  }
}

function encodeLocation(location: ObjectLocation, sequence: Sequence): string[] {
  if (location.kind === 'position') return ['P', String(indexOf(sequence.positions, location.positionId))];
  if (location.kind === 'hand-held') {
    return ['H', String(indexOf(sequence.performers, location.performerId)), location.hand === 'left' ? 'L' : 'R'];
  }
  return [
    'B',
    String(indexOf(sequence.positions, location.positionId)),
    String(indexOf(sequence.performers, location.performerId)),
    location.hand === 'left' ? 'L' : 'R',
  ];
}

function linkNumber(value: string, optional: boolean): number | undefined {
  if (value === '-' && optional) return undefined;
  const match = /^l(0|[1-9]\d*)$/.exec(value);
  if (!match) throw new Error('Invalid link reference.');
  return parseInteger(match[1]!, 'link reference');
}

function targetFromCode(value: string, positions: PositionDefinition[], performers: Performer[]) {
  if (/^p(0|[1-9]\d*)$/.test(value)) {
    const index = parseInteger(value.slice(1), 'position reference');
    const position = positions[index];
    if (!position) throw new Error('Unknown position reference.');
    return { kind: 'position' as const, positionId: position.id };
  }
  const circle = /^c([ABC])_([LR-])_(-|(?:-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?))$/.exec(value);
  if (circle) {
    return {
      kind: 'circle-position' as const,
      position: circle[1] as 'A' | 'B' | 'C',
      ...(circle[2] === '-' ? {} : { direction: circle[2] === 'L' ? 'left' as const : 'right' as const }),
      ...(circle[3] === '-' ? {} : { distance: parseNumber(circle[3]!, 'circle distance') }),
    };
  }
  const source = /^s(0|[1-9]\d*)$/.exec(value);
  if (source) {
    const performer = performers[parseInteger(source[1]!, 'pass source')];
    if (!performer) throw new Error('Unknown pass source.');
    return { kind: 'pass-source' as const, performerId: performer.id };
  }
  const recipient = /^r(0|[1-9]\d*)_([LR])$/.exec(value);
  if (recipient) {
    const performer = performers[parseInteger(recipient[1]!, 'pass recipient')];
    if (!performer) throw new Error('Unknown pass recipient.');
    return { kind: 'pass-recipient-hand' as const, performerId: performer.id, hand: recipient[2] === 'L' ? 'left' as const : 'right' as const };
  }
  throw new Error('Unknown action target.');
}

function decodeAction(
  parts: string[],
  positions: PositionDefinition[],
  performers: Performer[],
  links: LinkId[],
): NotationAction {
  const type = parts[0];
  const getLink = (value: string, optional: boolean): LinkId | undefined => {
    const index = linkNumber(value, optional);
    if (index === undefined) return undefined;
    const link = links[index];
    if (!link) throw new Error('Unknown link reference.');
    return link;
  };
  switch (type) {
    case 'H':
      if (parts.length !== 1) throw new Error('Invalid HOLD action.');
      return { type: 'HOLD' };
    case 'E':
      if (parts.length !== 1) throw new Error('Invalid EMPTY action.');
      return { type: 'EMPTY' };
    case 'L': {
      if (parts.length !== 3) throw new Error('Invalid LIFT action.');
      const target = targetFromCode(parts[1]!, positions, performers);
      if (target.kind === 'pass-recipient-hand') throw new Error('Invalid LIFT target.');
      return { type: 'LIFT', target, ...(getLink(parts[2]!, true) ? { linkId: getLink(parts[2]!, true) } : {}) };
    }
    case 'V': {
      if (parts.length !== 3) throw new Error('Invalid LEAVE action.');
      const target = targetFromCode(parts[1]!, positions, performers);
      if (target.kind === 'pass-source') throw new Error('Invalid LEAVE target.');
      return { type: 'LEAVE', target, ...(getLink(parts[2]!, true) ? { linkId: getLink(parts[2]!, true) } : {}) };
    }
    case 'B':
    case 'T': {
      if (parts.length !== 2) throw new Error('Invalid tap action.');
      const target = targetFromCode(parts[1]!, positions, performers);
      if (target.kind !== 'position' && target.kind !== 'circle-position') throw new Error('Invalid tap target.');
      return type === 'B' ? { type: 'BOUNCE', target } : { type: 'TAP', target };
    }
    case 'Z': {
      if (parts.length !== 3 || (parts[1] !== 'S' && parts[1] !== 'R')) throw new Error('Invalid ZIP action.');
      const linkId = getLink(parts[2]!, false);
      if (!linkId) throw new Error('Invalid ZIP link.');
      return { type: 'ZIP', role: parts[1] === 'S' ? 'source' : 'receiver', linkId };
    }
    case 'S': {
      if (parts.length !== 3) throw new Error('Invalid SPECIAL action.');
      const linkId = getLink(parts[2]!, true);
      return { type: 'SPECIAL', text: decodeText(parts[1]!), ...(linkId ? { linkId } : {}) };
    }
    default:
      throw new Error('Unknown action code.');
  }
}

function parseStream(value: string): { performer: number; hand: 'left' | 'right'; events: string[] } {
  const first = value.indexOf(':');
  const second = value.indexOf(':', first + 1);
  if (first < 1 || second < 0) throw new Error('Invalid action stream.');
  const performer = parseInteger(value.slice(0, first), 'stream performer');
  const handCode = value.slice(first + 1, second);
  if (handCode !== 'L' && handCode !== 'R') throw new Error('Invalid stream hand.');
  const eventText = value.slice(second + 1);
  return { performer, hand: handCode === 'L' ? 'left' : 'right', events: eventText === '-' ? [] : eventText.split('+') };
}

export const sequenceCodec: SequenceCodec = {
  encode(sequence) {
    const performerIndex = (id: string) => indexOf(sequence.performers, id);
    const ballIndex = (id: string) => indexOf(sequence.balls, id);
    const beatIndex = (id: string) => indexOf(sequence.beats, id);
    sequence.notation.forEach((entry) => {
      performerIndex(entry.performerId);
      beatIndex(entry.time.beatId);
    });
    const linkIds = [...new Set(sequence.notation.flatMap(({ action }) =>
      'linkId' in action && action.linkId !== undefined ? [action.linkId] : [],
    ))];
    const linkIndex = (id: LinkId) => {
      const index = linkIds.indexOf(id);
      if (index < 0) throw new Error('Unknown link reference.');
      return index;
    };

    const sequenceType = sequence.sequenceType === 'solo' ? 's'
      : sequence.sequenceType === 'circle-passing' ? 'c' : 'i';
    const timeSignature = [
      numberText(sequence.timeSignature.numerator),
      numberText(sequence.timeSignature.denominator),
      sequence.timeSignature.beatGrouping.length
        ? sequence.timeSignature.beatGrouping.map(numberText).join('+')
        : '-',
    ].join('.');
    const performers = sequence.performers.map((performer) =>
      `${encodeText(performer.name)}.${performer.identifier === undefined ? '-' : encodeText(performer.identifier)}`,
    ).join(',');
    const positions = sequence.positions.map((position) => position.kind === 'table'
      ? `T.${encodeText(position.name)}.${position.owner.kind === 'shared' ? 's' : `p${performerIndex(position.owner.performerId)}`}`
      : `B.${position.name}.${performerIndex(position.performerId)}.${position.hand === 'left' ? 'L' : 'R'}`,
    ).join(',');
    const placements = sequence.initialState.placements.map((placement) => [
      String(ballIndex(placement.ballId)),
      ...encodeLocation(placement.location, sequence),
    ].join('.')).join(',');
    const subdivisions = sequence.beats.flatMap((beat, beatIndexValue) =>
      beat.subdivisions.map((subdivision) => [
        String(beatIndexValue),
        encodeRational(subdivision.start),
        encodeRational(subdivision.duration),
        numberText(subdivision.depth),
      ].join('.')),
    ).join(',');
    const streams = sequence.performers.flatMap((performer, performerPosition) =>
      (['left', 'right'] as const).map((hand) => {
        const handCode = hand === 'left' ? 'L' : 'R';
        const events = sequence.notation.flatMap((entry, ordinal) =>
          entry.performerId === performer.id && entry.hand === hand
            ? [[
                String(ordinal),
                String(beatIndex(entry.time.beatId)),
                encodeRational(entry.time.offset),
                ...encodeActionParts(entry.action, sequence, linkIndex),
              ].join('.')]
            : [],
        );
        return `${performerPosition}:${handCode}:${events.length ? events.join('+') : '-'}`;
      }),
    ).join(',');
    const individualLayout = sequence.individualPassingLayout === undefined ? 'n'
      : sequence.individualPassingLayout === 'shared-positions' ? 's' : 'p';
    const tableLayout = sequence.tableLayout.type === 'solo' ? 's'
      : sequence.tableLayout.type === 'polygon' ? `p${numberText(sequence.tableLayout.sideCount)}`
        : `r${numberText(sequence.tableLayout.longSideSeatCount)}.${numberText(sequence.tableLayout.shortSideSeatCount)}`;
    const seats = sequence.seatAssignments.map((assignment) => assignment.seat.kind === 'polygon-edge'
      ? `${performerIndex(assignment.performerId)}.P.${numberText(assignment.seat.edgeIndex)}`
      : `${performerIndex(assignment.performerId)}.R.${assignment.seat.side}.${numberText(assignment.seat.seatIndex)}`,
    ).join(',');

    return [
      'P3',
      `S:${sequenceType}`,
      `Q:${numberText(sequence.bpm)}`,
      `T:${timeSignature}`,
      `B:${sequence.beats.length}`,
      `P:${performers}`,
      `X:${positions}`,
      `O:${sequence.balls.length}`,
      `I:${placements}`,
      `D:${subdivisions}`,
      `A:${streams}`,
      `J:${individualLayout}`,
      `M:${tableLayout}`,
      `C:${seats}`,
    ].join(';');
  },

  decode(code): SequenceDecodeResult {
    const trimmed = code.trim();
    if (!trimmed.startsWith('P')) {
      return { ok: false, code: 'malformed', message: 'This is not a POINTS sequence code.' };
    }
    if (!trimmed.startsWith(PREFIX)) {
      return { ok: false, code: 'unsupported-version', message: 'This sequence code uses a superseded or unsupported format.' };
    }

    try {
      const section = sectionMap(trimmed);
      const sequenceType = section.S === 's' ? 'solo'
        : section.S === 'c' ? 'circle-passing'
          : section.S === 'i' ? 'individual-passing' : null;
      if (!sequenceType) throw new Error('Invalid sequence type.');

      const bpm = parseNumber(section.Q, 'BPM');
      const [numeratorText, denominatorText, groupingText] = fields(section.T, 3, 'time signature');
      const timeSignature = {
        numerator: parseNumber(numeratorText!, 'time signature numerator'),
        denominator: parseNumber(denominatorText!, 'time signature denominator') as Sequence['timeSignature']['denominator'],
        beatGrouping: groupingText === '-' ? [] : groupingText!.split('+').map((value) => parseNumber(value, 'beat grouping')),
      };
      const beatCount = parseInteger(section.B, 'beat count');
      const performers: Performer[] = records(section.P).map((record, index) => {
        const [name, identifier] = fields(record, 2, 'performer');
        return {
          id: asPerformerId(`p${index}`),
          name: decodeText(name!),
          ...(identifier === '-' ? {} : { identifier: decodeText(identifier!) }),
        };
      });
      const positions: PositionDefinition[] = records(section.X).map((record, index) => {
        const parts = record.split('.');
        if (parts[0] === 'T' && parts.length === 3) {
          const owner = parts[2]!;
          return {
            id: asPositionId(`x${index}`),
            kind: 'table' as const,
            name: decodeText(parts[1]!),
            owner: owner === 's'
              ? { kind: 'shared' as const }
              : /^p(0|[1-9]\d*)$/.test(owner)
                ? { kind: 'performer' as const, performerId: performers[parseInteger(owner.slice(1), 'position owner')]!.id }
                : (() => { throw new Error('Invalid position owner.'); })(),
          };
        }
        if (parts[0] === 'B' && parts.length === 4) {
          const performer = performers[parseInteger(parts[2]!, 'hand back performer')];
          if (!performer || (parts[3] !== 'L' && parts[3] !== 'R') || (parts[1] !== 'L' && parts[1] !== 'R')) {
            throw new Error('Invalid hand back position.');
          }
          return {
            id: asPositionId(`x${index}`), kind: 'hand-back' as const,
            name: parts[1] as 'L' | 'R', performerId: performer.id,
            hand: parts[3] === 'L' ? 'left' as const : 'right' as const,
          };
        }
        throw new Error('Invalid position definition.');
      });
      const ballCount = parseInteger(section.O, 'object count');
      const balls: Ball[] = Array.from({ length: ballCount }, (_, index) => ({ id: asBallId(`o${index}`) }));
      const placements = records(section.I).map((record) => {
        const parts = record.split('.');
        const ball = balls[parseInteger(parts[0]!, 'placement object')];
        if (!ball) throw new Error('Unknown placement object.');
        let location: ObjectLocation;
        if (parts[1] === 'P' && parts.length === 3) {
          const position = positions[parseInteger(parts[2]!, 'placement position')];
          if (!position) throw new Error('Unknown placement position.');
          location = { kind: 'position', positionId: position.id };
        } else if (parts[1] === 'H' && parts.length === 4) {
          const performer = performers[parseInteger(parts[2]!, 'held performer')];
          if (!performer || (parts[3] !== 'L' && parts[3] !== 'R')) throw new Error('Invalid held placement.');
          location = { kind: 'hand-held', performerId: performer.id, hand: parts[3] === 'L' ? 'left' : 'right' };
        } else if (parts[1] === 'B' && parts.length === 5) {
          const position = positions[parseInteger(parts[2]!, 'balanced position')];
          const performer = performers[parseInteger(parts[3]!, 'balanced performer')];
          if (!position || !performer || (parts[4] !== 'L' && parts[4] !== 'R')) throw new Error('Invalid hand back placement.');
          location = {
            kind: 'hand-back', positionId: position.id, performerId: performer.id,
            hand: parts[4] === 'L' ? 'left' : 'right',
          };
        } else throw new Error('Invalid object placement.');
        return { ballId: ball.id, location };
      });
      const beats: Beat[] = Array.from({ length: beatCount }, (_, index) => ({
        id: asBeatId(`b${index}`), subdivisions: [],
      }));
      records(section.D).forEach((record) => {
        const [beatText, startText, durationText, depthText] = fields(record, 4, 'subdivision');
        const beat = beats[parseInteger(beatText!, 'subdivision beat')];
        if (!beat) throw new Error('Unknown subdivision beat.');
        const mutableBeat = beat as { id: Beat['id']; subdivisions: Beat['subdivisions'][number][] };
        mutableBeat.subdivisions.push({
          id: asSubdivisionId(`b${beatText}s${mutableBeat.subdivisions.length}`),
          start: decodeRational(startText!),
          duration: decodeRational(durationText!),
          depth: parseNumber(depthText!, 'subdivision depth'),
        });
      });

      const streamRecords = records(section.A).map(parseStream);
      if (streamRecords.length !== performers.length * 2) throw new Error('Action stream count does not match performers.');
      const rawEvents: { ordinal: number; performer: number; hand: 'left' | 'right'; parts: string[] }[] = [];
      streamRecords.forEach((stream, streamIndex) => {
        const expectedPerformer = Math.floor(streamIndex / 2);
        const expectedHand = streamIndex % 2 === 0 ? 'left' : 'right';
        if (stream.performer !== expectedPerformer || stream.hand !== expectedHand) {
          throw new Error('Action streams are not in canonical order.');
        }
        stream.events.forEach((event) => {
          const eventParts = event.split('.');
          if (eventParts.length < 4) throw new Error('Invalid action event.');
          rawEvents.push({
            ordinal: parseInteger(eventParts[0]!, 'event order'),
            performer: stream.performer,
            hand: stream.hand,
            parts: eventParts.slice(1),
          });
        });
      });
      rawEvents.sort((left, right) => left.ordinal - right.ordinal);
      if (rawEvents.some((event, index) => event.ordinal !== index)) throw new Error('Action event order is incomplete.');

      const linkIndexes = new Set<number>();
      rawEvents.forEach((event) => {
        const actionType = event.parts[2];
        if (actionType === 'L' || actionType === 'V' || actionType === 'Z' || actionType === 'S') {
          const linkPart = actionType === 'Z' ? event.parts[4] : event.parts[4];
          if (linkPart !== '-') {
            const index = linkNumber(linkPart!, actionType !== 'Z');
            if (index !== undefined) linkIndexes.add(index);
          }
        }
      });
      const sortedLinks = [...linkIndexes].sort((left, right) => left - right);
      if (sortedLinks.some((value, index) => value !== index)) throw new Error('Link references are not contiguous.');
      const links = sortedLinks.map((index) => asLinkId(`l${index}`));

      const notation: NotationEntry[] = rawEvents.map((event, index) => {
        const [beatText, offsetText, ...actionParts] = event.parts;
        const beat = beats[parseInteger(beatText!, 'action beat')];
        if (!beat) throw new Error('Unknown action beat.');
        return {
          id: asActionEntryId(`a${index}`),
          performerId: performers[event.performer]!.id,
          hand: event.hand,
          time: { beatId: beat.id, offset: decodeRational(offsetText!) },
          action: decodeAction(actionParts, positions, performers, links),
        };
      });

      const individualPassingLayout = section.J === 'n' ? undefined
        : section.J === 's' ? 'shared-positions'
          : section.J === 'p' ? 'per-performer-positions' : null;
      if (individualPassingLayout === null) throw new Error('Invalid individual passing layout.');
      let tableLayout: TableLayout;
      if (section.M === 's') tableLayout = { type: 'solo' };
      else if (/^p-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(section.M)) {
        tableLayout = { type: 'polygon', sideCount: parseNumber(section.M.slice(1), 'polygon side count') };
      } else if (/^r-?(?:0|[1-9]\d*)(?:\.\d+)?\.-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(section.M)) {
        const [longSideSeatCount, shortSideSeatCount] = section.M.slice(1).split('.').map((value) => parseNumber(value!, 'rectangle seat count'));
        tableLayout = { type: 'rectangle', longSideSeatCount: longSideSeatCount!, shortSideSeatCount: shortSideSeatCount! };
      } else throw new Error('Invalid table layout.');

      const seatAssignments: SeatAssignment[] = records(section.C).map((record) => {
        const parts = record.split('.');
        const performer = performers[parseInteger(parts[0]!, 'seat performer')];
        if (!performer) throw new Error('Unknown seat performer.');
        if (parts[1] === 'P' && parts.length === 3) {
          return { performerId: performer.id, seat: { kind: 'polygon-edge', edgeIndex: parseNumber(parts[2]!, 'polygon edge') } };
        }
        if (parts[1] === 'R' && parts.length === 4) {
          if (!['long-a', 'long-b', 'short-a', 'short-b'].includes(parts[2]!)) throw new Error('Invalid rectangle side.');
          return {
            performerId: performer.id,
            seat: { kind: 'rectangle-side', side: parts[2] as 'long-a' | 'long-b' | 'short-a' | 'short-b', seatIndex: parseNumber(parts[3]!, 'rectangle seat') },
          };
        }
        throw new Error('Invalid seat assignment.');
      });

      return {
        ok: true,
        sequence: {
          id: asSequenceId('sequence'),
          sequenceType,
          timeSignature,
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
        },
      };
    } catch {
      return { ok: false, code: 'malformed', message: 'The sequence code is damaged or incomplete.' };
    }
  },
};

export function isSequenceCode(value: string): boolean {
  return value.trim().startsWith('P3;');
}
