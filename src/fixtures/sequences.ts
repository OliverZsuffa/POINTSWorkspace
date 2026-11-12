import {
  asActionEntryId,
  asBallId,
  asBeatId,
  asLinkId,
  asPerformerId,
  asPositionId,
  asSequenceId,
  asSubdivisionId,
} from '../domain/ids';
import type {
  NotationEntry,
  Sequence,
  SequenceFragment,
} from '../domain/model';
import { rational } from '../domain/time/rational';
import { DEFAULT_TIME_SIGNATURE } from '../domain/time/time-signature';

const performerId = asPerformerId('performer-1');
const leftPositionId = asPositionId('position-A');
const middlePositionId = asPositionId('position-B');
const rightPositionId = asPositionId('position-C');
const ballId = asBallId('ball-1');

export const representativeSoloSequence: Sequence = {
  id: asSequenceId('sequence-solo-example'),
  sequenceType: 'solo',
  timeSignature: DEFAULT_TIME_SIGNATURE,
  bpm: 120,
  beats: [
    { id: asBeatId('beat-1'), subdivisions: [] },
    {
      id: asBeatId('beat-2'),
      subdivisions: [
        {
          id: asSubdivisionId('beat-2-first-half'),
          start: rational(0),
          duration: rational(1, 2),
          depth: 1,
        },
        {
          id: asSubdivisionId('beat-2-second-half'),
          start: rational(1, 2),
          duration: rational(1, 2),
          depth: 1,
        },
      ],
    },
    { id: asBeatId('beat-3'), subdivisions: [] },
    { id: asBeatId('beat-4'), subdivisions: [] },
  ],
  performers: [{ id: performerId, name: 'Juggler 1' }],
  positions: [
    {
      id: leftPositionId,
      kind: 'table',
      name: 'A',
      owner: { kind: 'performer', performerId },
    },
    {
      id: middlePositionId,
      kind: 'table',
      name: 'B',
      owner: { kind: 'performer', performerId },
    },
    {
      id: rightPositionId,
      kind: 'table',
      name: 'C',
      owner: { kind: 'performer', performerId },
    },
    {
      id: asPositionId('position-left-back'),
      kind: 'hand-back',
      name: 'L',
      performerId,
      hand: 'left',
    },
    {
      id: asPositionId('position-right-back'),
      kind: 'hand-back',
      name: 'R',
      performerId,
      hand: 'right',
    },
  ],
  balls: [{ id: ballId }],
  initialState: {
    placements: [
      {
        ballId,
        location: { kind: 'position', positionId: leftPositionId },
      },
    ],
  },
  notation: [
    {
      id: asActionEntryId('entry-lift'),
      performerId,
      hand: 'right',
      time: { beatId: asBeatId('beat-1'), offset: rational(0) },
      action: {
        type: 'LIFT',
        target: { kind: 'position', positionId: leftPositionId },
      },
    },
    {
      id: asActionEntryId('entry-hold'),
      performerId,
      hand: 'right',
      time: { beatId: asBeatId('beat-2'), offset: rational(0) },
      action: { type: 'HOLD' },
    },
    {
      id: asActionEntryId('entry-leave'),
      performerId,
      hand: 'right',
      time: { beatId: asBeatId('beat-3'), offset: rational(0) },
      action: {
        type: 'LEAVE',
        target: { kind: 'position', positionId: middlePositionId },
      },
    },
    {
      id: asActionEntryId('entry-tap'),
      performerId,
      hand: 'left',
      time: { beatId: asBeatId('beat-4'), offset: rational(0) },
      action: {
        type: 'TAP',
        target: { kind: 'position', positionId: rightPositionId },
      },
    },
  ],
  tableLayout: { type: 'solo' },
  seatAssignments: [],
};

export const representativeIndividualPassingSequence: Sequence = {
  id: asSequenceId('sequence-individual-passing-example'),
  sequenceType: 'individual-passing',
  timeSignature: DEFAULT_TIME_SIGNATURE,
  bpm: 120,
  beats: [{ id: asBeatId('pass-beat-1'), subdivisions: [] }],
  performers: [
    { id: asPerformerId('pass-performer-a'), name: 'Juggler 1', identifier: 'a' },
    { id: asPerformerId('pass-performer-b'), name: 'Juggler 2', identifier: 'b' },
  ],
  positions: [
    {
      id: asPositionId('shared-A'),
      kind: 'table',
      name: 'A',
      owner: { kind: 'shared' },
    },
    {
      id: asPositionId('shared-B'),
      kind: 'table',
      name: 'B',
      owner: { kind: 'shared' },
    },
    {
      id: asPositionId('shared-C'),
      kind: 'table',
      name: 'C',
      owner: { kind: 'shared' },
    },
  ],
  balls: [{ id: asBallId('pass-ball-1') }],
  initialState: {
    placements: [
      {
        ballId: asBallId('pass-ball-1'),
        location: {
          kind: 'hand-held',
          performerId: asPerformerId('pass-performer-a'),
          hand: 'right',
        },
      },
    ],
  },
  notation: [
    {
      id: asActionEntryId('pass-sender-leave'),
      performerId: asPerformerId('pass-performer-a'),
      hand: 'right',
      time: { beatId: asBeatId('pass-beat-1'), offset: rational(0) },
      action: {
        type: 'LEAVE',
        target: {
          kind: 'pass-recipient-hand',
          performerId: asPerformerId('pass-performer-b'),
          hand: 'left',
        },
        linkId: asLinkId('pass-link-1'),
      },
    },
    {
      id: asActionEntryId('pass-receiver-lift'),
      performerId: asPerformerId('pass-performer-b'),
      hand: 'left',
      time: { beatId: asBeatId('pass-beat-1'), offset: rational(0) },
      action: {
        type: 'LIFT',
        target: {
          kind: 'pass-source',
          performerId: asPerformerId('pass-performer-a'),
        },
        linkId: asLinkId('pass-link-1'),
      },
    },
  ],
  individualPassingLayout: 'shared-positions',
  tableLayout: {
    type: 'rectangle',
    longSideSeatCount: 1,
    shortSideSeatCount: 1,
  },
  seatAssignments: [
    {
      performerId: asPerformerId('pass-performer-a'),
      seat: { kind: 'rectangle-side', side: 'long-a', seatIndex: 0 },
    },
    {
      performerId: asPerformerId('pass-performer-b'),
      seat: { kind: 'rectangle-side', side: 'long-b', seatIndex: 0 },
    },
  ],
};

export const invalidInitialStateSequence: Sequence = {
  ...representativeSoloSequence,
  id: asSequenceId('sequence-invalid-example'),
  balls: [
    { id: asBallId('ball-1') },
    { id: asBallId('ball-2') },
  ],
  initialState: {
    placements: [
      {
        ballId: asBallId('ball-1'),
        location: { kind: 'position', positionId: leftPositionId },
      },
      {
        ballId: asBallId('ball-2'),
        location: { kind: 'position', positionId: leftPositionId },
      },
    ],
  },
  notation: [],
};

export const representativeNotationExamples: readonly NotationEntry[] = [
  {
    id: asActionEntryId('example-bounce'),
    performerId,
    hand: 'right',
    time: { beatId: asBeatId('beat-1'), offset: rational(0) },
    action: {
      type: 'BOUNCE',
      target: { kind: 'position', positionId: leftPositionId },
    },
  },
  {
    id: asActionEntryId('example-empty'),
    performerId,
    hand: 'right',
    time: { beatId: asBeatId('beat-2'), offset: rational(0) },
    action: { type: 'EMPTY' },
  },
  {
    id: asActionEntryId('example-zip-source'),
    performerId,
    hand: 'right',
    time: { beatId: asBeatId('beat-3'), offset: rational(0) },
    action: {
      type: 'ZIP',
      role: 'source',
      linkId: asLinkId('zip-example'),
    },
  },
  {
    id: asActionEntryId('example-zip-receiver'),
    performerId,
    hand: 'left',
    time: { beatId: asBeatId('beat-3'), offset: rational(0) },
    action: {
      type: 'ZIP',
      role: 'receiver',
      linkId: asLinkId('zip-example'),
    },
  },
  {
    id: asActionEntryId('example-special-left'),
    performerId,
    hand: 'left',
    time: { beatId: asBeatId('beat-4'), offset: rational(0) },
    action: {
      type: 'SPECIAL',
      text: 'Clap',
      linkId: asLinkId('special-clap'),
    },
  },
  {
    id: asActionEntryId('example-special-right'),
    performerId,
    hand: 'right',
    time: { beatId: asBeatId('beat-4'), offset: rational(0) },
    action: {
      type: 'SPECIAL',
      text: 'Clap',
      linkId: asLinkId('special-clap'),
    },
  },
];

export const representativeSequenceFragment: SequenceFragment = {
  sequenceType: representativeSoloSequence.sequenceType,
  timeSignature: representativeSoloSequence.timeSignature,
  beats: representativeSoloSequence.beats.slice(0, 2),
  performers: representativeSoloSequence.performers,
  positions: representativeSoloSequence.positions,
  notation: representativeSoloSequence.notation.slice(0, 2),
};
