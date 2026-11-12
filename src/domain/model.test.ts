import { describe, expect, it } from 'vitest';
import {
  invalidInitialStateSequence,
  representativeIndividualPassingSequence,
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
    const actionTypes = new Set([
      ...representativeNotationExamples.map((entry) => entry.action.type),
      ...representativeSoloSequence.notation.map((entry) => entry.action.type),
    ]);

    expect(actionTypes).toEqual(
      new Set([
        'HOLD',
        'LIFT',
        'LEAVE',
        'BOUNCE',
        'TAP',
        'EMPTY',
        'ZIP',
        'SPECIAL',
      ]),
    );
  });

  it('represents an individual pass as simultaneous linked sender and receiver entries', () => {
    const sender = representativeIndividualPassingSequence.notation[0];
    const receiver = representativeIndividualPassingSequence.notation[1];

    expect(sender).toBeDefined();
    expect(receiver).toBeDefined();

    if (sender && receiver) {
      expect(sender.action.type).toBe('LEAVE');
      expect(receiver.action.type).toBe('LIFT');
      expect(sender.time).toEqual(receiver.time);

      if (sender.action.type === 'LEAVE' && receiver.action.type === 'LIFT') {
        expect(sender.action.linkId).toBe(receiver.action.linkId);
      }
    }
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
