import { describe, expect, it } from 'vitest';
import { asBallId, asBeatId, asPerformerId, asPositionId, asSequenceId } from '../../domain/ids';
import { DEFAULT_TIME_SIGNATURE } from '../../domain/time/time-signature';
import { rational } from '../../domain/time/rational';
import type { Sequence, SimulationResult } from '../../domain/model';
import { getLoopInitialState } from './playback';

describe('renderer playback state', () => {
  it('carries swapped object identities into the next loop', () => {
    const performerId = asPerformerId('performer-a');
    const positionA = asPositionId('position-a');
    const positionC = asPositionId('position-c');
    const blue = asBallId('blue');
    const orange = asBallId('orange');
    const sequence: Sequence = {
      id: asSequenceId('loop-test'),
      sequenceType: 'solo',
      timeSignature: DEFAULT_TIME_SIGNATURE,
      bpm: 120,
      beats: [{ id: asBeatId('beat-1'), subdivisions: [] }],
      performers: [{ id: performerId, name: 'Juggler 1' }],
      positions: [
        { kind: 'table', id: positionA, name: 'A', owner: { kind: 'performer', performerId } },
        { kind: 'table', id: positionC, name: 'C', owner: { kind: 'performer', performerId } },
      ],
      balls: [{ id: blue }, { id: orange }],
      initialState: { placements: [
        { ballId: blue, location: { kind: 'position', positionId: positionA } },
        { ballId: orange, location: { kind: 'position', positionId: positionC } },
      ] },
      notation: [],
      tableLayout: { type: 'solo' },
      seatAssignments: [],
    };
    const simulation = {
      snapshots: [{
        at: { beatId: asBeatId('beat-1'), offset: rational(0) },
        phase: 'after',
        ballLocations: {
          [blue]: { kind: 'position', positionId: positionC },
          [orange]: { kind: 'position', positionId: positionA },
        },
        handStates: {},
      }],
      validation: { isValid: true, issues: [] },
    } as SimulationResult;

    expect(getLoopInitialState(sequence, simulation)?.placements).toEqual([
      { ballId: blue, location: { kind: 'position', positionId: positionC } },
      { ballId: orange, location: { kind: 'position', positionId: positionA } },
    ]);
  });
});
