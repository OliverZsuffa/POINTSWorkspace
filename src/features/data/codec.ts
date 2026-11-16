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
const MAX_CODE_LENGTH = 1_000_000;
const MAX_SEQUENCE_ITEMS = 100_000;
type Sections = {
  sequenceType: string;
  bpm: string;
  timeSignature: string;
  beatCount: string;
  performers: string;
  positions: string;
  ballCount: string;
  placements: string;
  subdivisions: string;
  actionStreams: string;
  individualPassingLayout: string;
  tableLayout: string;
  seats: string;
};

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
  if (parts[0] !== 'P3' || parts.length !== 14) {
    throw new Error('Invalid P3 document framing.');
  }
  const values = parts.slice(1);
  return {
    sequenceType: values[0]!,
    bpm: values[1]!,
    timeSignature: values[2]!,
    beatCount: values[3]!,
    performers: values[4]!,
    positions: values[5]!,
    ballCount: values[6]!,
    placements: values[7]!,
    subdivisions: values[8]!,
    actionStreams: values[9]!,
    individualPassingLayout: values[10]!,
    tableLayout: values[11]!,
    seats: values[12]!,
  };
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

function parseStream(value: string): { hand: 'left' | 'right'; cells: string[] } {
  const separator = value.indexOf(':');
  if (separator !== 1) throw new Error('Invalid action stream.');
  const handCode = value[0];
  if (handCode !== 'L' && handCode !== 'R') throw new Error('Invalid stream hand.');
  const timeline = value.slice(separator + 1);
  return {
    hand: handCode === 'L' ? 'left' : 'right',
    cells: timeline === '' ? [] : timeline.split('|'),
  };
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
    const streams = sequence.performers.flatMap((performer) =>
      (['left', 'right'] as const).map((hand) => {
        const handCode = hand === 'left' ? 'L' : 'R';
        const cells = sequence.beats.map((beat) => {
          const events = sequence.notation.flatMap((entry, ordinal) =>
            entry.performerId === performer.id &&
            entry.hand === hand &&
            entry.time.beatId === beat.id
              ? [[
                  String(ordinal),
                  encodeRational(entry.time.offset),
                  ...encodeActionParts(entry.action, sequence, linkIndex),
                ].join('.')]
              : [],
          );
          return events.length ? events.join('+') : '-';
        });
        return `${handCode}:${cells.join('|')}`;
      }),
    ).join(',');
    const individualLayout = sequence.individualPassingLayout === undefined ? 'n'
      : sequence.individualPassingLayout === 'shared-positions' ? 's' : 'p';
    const tableLayout = sequence.tableLayout.type === 'solo' ? 's'
      : sequence.tableLayout.type === 'polygon' ? `p${numberText(sequence.tableLayout.sideCount)}`
        : `r${numberText(sequence.tableLayout.longSideSeatCount)}_${numberText(sequence.tableLayout.shortSideSeatCount)}`;
    const seats = sequence.seatAssignments.map((assignment) => assignment.seat.kind === 'polygon-edge'
      ? `${performerIndex(assignment.performerId)}.P.${numberText(assignment.seat.edgeIndex)}`
      : `${performerIndex(assignment.performerId)}.R.${assignment.seat.side}.${numberText(assignment.seat.seatIndex)}`,
    ).join(',');

    return [
      'P3',
      sequenceType,
      numberText(sequence.bpm),
      timeSignature,
      String(sequence.beats.length),
      performers,
      positions,
      String(sequence.balls.length),
      placements,
      subdivisions,
      streams,
      individualLayout,
      tableLayout,
      seats,
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
      if (trimmed.length > MAX_CODE_LENGTH) throw new Error('Sequence code exceeds the maximum supported length.');
      const section = sectionMap(trimmed);
      const sequenceType = section.sequenceType === 's' ? 'solo'
        : section.sequenceType === 'c' ? 'circle-passing'
          : section.sequenceType === 'i' ? 'individual-passing' : null;
      if (!sequenceType) throw new Error('Invalid sequence type.');

      const bpm = parseNumber(section.bpm, 'BPM');
      const [numeratorText, denominatorText, groupingText] = fields(section.timeSignature, 3, 'time signature');
      const timeSignature = {
        numerator: parseNumber(numeratorText!, 'time signature numerator'),
        denominator: parseNumber(denominatorText!, 'time signature denominator') as Sequence['timeSignature']['denominator'],
        beatGrouping: groupingText === '-' ? [] : groupingText!.split('+').map((value) => parseNumber(value, 'beat grouping')),
      };
      const beatCount = parseInteger(section.beatCount, 'beat count');
      if (beatCount > MAX_SEQUENCE_ITEMS) throw new Error('Beat count exceeds the decoder limit.');
      const performerRecords = records(section.performers);
      if (performerRecords.length > MAX_SEQUENCE_ITEMS) throw new Error('Performer count exceeds the decoder limit.');
      const performers: Performer[] = performerRecords.map((record, index) => {
        const [name, identifier] = fields(record, 2, 'performer');
        return {
          id: asPerformerId(`p${index}`),
          name: decodeText(name!),
          ...(identifier === '-' ? {} : { identifier: decodeText(identifier!) }),
        };
      });
      const positions: PositionDefinition[] = records(section.positions).map((record, index) => {
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
      const ballCount = parseInteger(section.ballCount, 'object count');
      if (ballCount > MAX_SEQUENCE_ITEMS) throw new Error('Object count exceeds the decoder limit.');
      const balls: Ball[] = Array.from({ length: ballCount }, (_, index) => ({ id: asBallId(`o${index}`) }));
      const placements = records(section.placements).map((record) => {
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
      records(section.subdivisions).forEach((record) => {
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

      const streamRecords = records(section.actionStreams).map(parseStream);
      if (streamRecords.length !== performers.length * 2) throw new Error('Action stream count does not match performers.');
      const rawEvents: {
        ordinal: number;
        performer: number;
        hand: 'left' | 'right';
        beat: number;
        offset: string;
        actionParts: string[];
      }[] = [];
      streamRecords.forEach((stream, streamIndex) => {
        const expectedPerformer = Math.floor(streamIndex / 2);
        const expectedHand = streamIndex % 2 === 0 ? 'left' : 'right';
        if (stream.hand !== expectedHand || stream.cells.length !== beats.length) {
          throw new Error('Action streams do not match the performer and beat structure.');
        }
        stream.cells.forEach((cell, beatPosition) => {
          if (cell === '-') return;
          cell.split('+').forEach((event) => {
            const eventParts = event.split('.');
            if (eventParts.length < 3) throw new Error('Invalid action event.');
            rawEvents.push({
              ordinal: parseInteger(eventParts[0]!, 'event order'),
              performer: expectedPerformer,
              hand: stream.hand,
              beat: beatPosition,
              offset: eventParts[1]!,
              actionParts: eventParts.slice(2),
            });
          });
        });
      });
      rawEvents.sort((left, right) => left.ordinal - right.ordinal);
      if (rawEvents.some((event, index) => event.ordinal !== index)) throw new Error('Action event order is incomplete.');

      const linkIndexes = new Set<number>();
      rawEvents.forEach((event) => {
        const actionType = event.actionParts[0];
        if (actionType === 'L' || actionType === 'V' || actionType === 'Z' || actionType === 'S') {
          const linkPart = event.actionParts[2];
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
        const beat = beats[event.beat];
        if (!beat) throw new Error('Unknown action beat.');
        return {
          id: asActionEntryId(`a${index}`),
          performerId: performers[event.performer]!.id,
          hand: event.hand,
          time: { beatId: beat.id, offset: decodeRational(event.offset) },
          action: decodeAction(event.actionParts, positions, performers, links),
        };
      });

      const individualPassingLayout = section.individualPassingLayout === 'n' ? undefined
        : section.individualPassingLayout === 's' ? 'shared-positions'
          : section.individualPassingLayout === 'p' ? 'per-performer-positions' : null;
      if (individualPassingLayout === null) throw new Error('Invalid individual passing layout.');
      let tableLayout: TableLayout;
      if (section.tableLayout === 's') tableLayout = { type: 'solo' };
      else if (section.tableLayout.startsWith('p')) {
        tableLayout = { type: 'polygon', sideCount: parseNumber(section.tableLayout.slice(1), 'polygon side count') };
      } else if (section.tableLayout.startsWith('r')) {
        const dimensions = section.tableLayout.slice(1).split('_');
        if (dimensions.length !== 2) throw new Error('Invalid rectangle table layout.');
        tableLayout = {
          type: 'rectangle',
          longSideSeatCount: parseNumber(dimensions[0]!, 'rectangle long side seat count'),
          shortSideSeatCount: parseNumber(dimensions[1]!, 'rectangle short side seat count'),
        };
      } else throw new Error('Invalid table layout.');

      const seatAssignments: SeatAssignment[] = records(section.seats).map((record) => {
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
