import { describe, expect, it } from 'vitest';
import {
  invalidInitialStateSequence,
  representativeNotationExamples,
  representativeSoloSequence,
} from '../fixtures/sequences';

describe('shared sequence model fixtures', () => {
  it('provides stable performer, position, ball and beat identities', () => {
    expect(representativeSoloSequence.performers).toHaveLength(1);
    expect(
      representativeSoloSequence.positions.filter(
        (position) => position.kind === 'table',
      ),
    ).toHaveLength(3);
    expect(representativeSoloSequence.beats).toHaveLength(4);
    expect(representativeSoloSequence.initialState.placements).toHaveLength(1);
  });

  it('represents all current base notation action families', () => {
    const actionTypes = new Set(
      representativeNotationExamples.map((entry) => entry.action.type),
    );

    expect(actionTypes).toEqual(
      new Set(['BOUNCE', 'EMPTY', 'ZIP', 'SPECIAL']),
    );
    expect(
      representativeSoloSequence.notation.map((entry) => entry.action.type),
    ).toEqual(['LIFT', 'HOLD', 'LEAVE', 'TAP']);
  });

  it('can represent invalid imported state without changing its structure', () => {
    expect(invalidInitialStateSequence.initialState.placements).toHaveLength(2);
    expect(
      invalidInitialStateSequence.initialState.placements[0]?.location,
    ).toEqual(
      invalidInitialStateSequence.initialState.placements[1]?.location,
    );
  });
});
