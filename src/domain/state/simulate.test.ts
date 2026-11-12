import { describe, expect, it } from 'vitest';
import { asActionEntryId, asBallId, asLinkId, asPerformerId, asPositionId } from '../ids';
import type { NotationEntry, Sequence } from '../model';
import { rational } from '../time/rational';
import {
  invalidInitialStateSequence,
  representativeIndividualPassingSequence,
  representativeSoloSequence,
} from '../../fixtures/sequences';
import { simulateSequence, validateSequence } from './simulate';

const performerId = representativeSoloSequence.performers[0]!.id;
const beatId = representativeSoloSequence.beats[0]!.id;
const positionA = asPositionId('position-A');
const positionB = asPositionId('position-B');
const positionC = asPositionId('position-C');
const rightBack = asPositionId('position-right-back');

function entry(
  id: string,
  hand: 'left' | 'right',
  action: NotationEntry['action'],
  performer = performerId,
): NotationEntry {
  return {
    id: asActionEntryId(id),
    performerId: performer,
    hand,
    time: { beatId, offset: rational(0) },
    action,
  };
}

describe('object state simulation', () => {
  it('simulates a valid solo sequence and records before and after snapshots', () => {
    const result = simulateSequence(representativeSoloSequence);
    expect(result.validation.isValid).toBe(true);
    expect(result.snapshots).toHaveLength(8);
    expect(result.snapshots[0]?.phase).toBe('before');
    expect(result.snapshots[1]?.phase).toBe('after');
    expect(result.snapshots[0]?.ballLocations[asBallId('ball-1')]).toEqual({
      kind: 'position',
      positionId: positionA,
    });
    expect(result.snapshots[1]?.handStates[performerId]?.right.heldBallId).toBe('ball-1');
    expect(result.snapshots[5]?.ballLocations[asBallId('ball-1')]).toEqual({
      kind: 'position',
      positionId: positionB,
    });
  });

  it('transfers an object through a reciprocal individual pass', () => {
    const result = simulateSequence(representativeIndividualPassingSequence);
    expect(result.validation.isValid).toBe(true);
    const receiverId = representativeIndividualPassingSequence.performers[1]!.id;
    expect(result.snapshots[1]?.handStates[receiverId]?.left.heldBallId).toBe('pass-ball-1');
  });

  it('rejects TAP while holding and accepts BOUNCE while holding', () => {
    const base: Sequence = {
      ...representativeSoloSequence,
      initialState: {
        placements: [{
          ballId: asBallId('ball-1'),
          location: { kind: 'hand-held', performerId, hand: 'right' },
        }],
      },
    };
    const tap = { ...base, notation: [entry('tap-held', 'right', {
      type: 'TAP',
      target: { kind: 'position', positionId: positionA },
    })] };
    const bounce = { ...base, notation: [entry('bounce-held', 'right', {
      type: 'BOUNCE',
      target: { kind: 'position', positionId: positionA },
    })] };

    expect(validateSequence(tap).issues.map((item) => item.code)).toContain('tap-with-held-ball');
    const bounceResult = simulateSequence(bounce);
    expect(bounceResult.validation.isValid).toBe(true);
    expect(bounceResult.snapshots[1]?.handStates[performerId]?.right.heldBallId).toBe('ball-1');
  });

  it('allows a balanced object while the fingers perform SPECIAL', () => {
    const sequence: Sequence = {
      ...representativeSoloSequence,
      initialState: {
        placements: [{
          ballId: asBallId('ball-1'),
          location: { kind: 'hand-back', positionId: rightBack, performerId, hand: 'right' },
        }],
      },
      notation: [entry('special-balanced', 'right', { type: 'SPECIAL', text: 'Clap' })],
    };

    const result = simulateSequence(sequence);
    expect(result.validation.isValid).toBe(true);
    expect(result.snapshots[1]?.handStates[performerId]?.right.balancedBallId).toBe('ball-1');
  });

  it('allows LIFT and LEAVE while an object is balanced on the same hand', () => {
    const liftSequence: Sequence = {
      ...representativeSoloSequence,
      balls: [...representativeSoloSequence.balls, { id: asBallId('ball-2') }],
      initialState: {
        placements: [
          { ballId: asBallId('ball-1'), location: { kind: 'position', positionId: positionA } },
          { ballId: asBallId('ball-2'), location: { kind: 'hand-back', positionId: rightBack, performerId, hand: 'right' } },
        ],
      },
      notation: [entry('lift-with-balanced', 'right', {
        type: 'LIFT',
        target: { kind: 'position', positionId: positionA },
      })],
    };
    const leaveSequence: Sequence = {
      ...representativeSoloSequence,
      balls: [...representativeSoloSequence.balls, { id: asBallId('ball-2') }],
      initialState: {
        placements: [
          { ballId: asBallId('ball-1'), location: { kind: 'hand-held', performerId, hand: 'right' } },
          { ballId: asBallId('ball-2'), location: { kind: 'hand-back', positionId: rightBack, performerId, hand: 'right' } },
        ],
      },
      notation: [entry('leave-with-balanced', 'right', {
        type: 'LEAVE',
        target: { kind: 'position', positionId: positionB },
      })],
    };

    expect(simulateSequence(liftSequence).validation.isValid).toBe(true);
    expect(simulateSequence(leaveSequence).validation.isValid).toBe(true);
  });

  it('resolves circle passing targets relative to the acting performer', () => {
    const secondPerformer = asPerformerId('performer-2');
    const otherA = asPositionId('position-A-performer-2');
    const sequence: Sequence = {
      ...representativeSoloSequence,
      sequenceType: 'circle-passing',
      performers: [
        ...representativeSoloSequence.performers,
        { id: secondPerformer, name: 'Juggler 2' },
      ],
      positions: [
        ...representativeSoloSequence.positions,
        {
          id: otherA,
          kind: 'table',
          name: 'A',
          owner: { kind: 'performer', performerId: secondPerformer },
        },
      ],
      initialState: {
        placements: [{ ballId: asBallId('ball-1'), location: { kind: 'position', positionId: otherA } }],
      },
      notation: [entry('circle-lift', 'right', {
        type: 'LIFT',
        target: { kind: 'circle-position', position: 'A', direction: 'left', distance: 1 },
      })],
    };

    const result = simulateSequence(sequence);
    expect(result.validation.isValid).toBe(true);
    expect(result.snapshots[1]?.handStates[performerId]?.right.heldBallId).toBe('ball-1');
  });

  it('allows BOUNCE while a second object is balanced on the same hand', () => {
    const sequence: Sequence = {
      ...representativeSoloSequence,
      balls: [...representativeSoloSequence.balls, { id: asBallId('ball-2') }],
      initialState: {
        placements: [
          { ballId: asBallId('ball-1'), location: { kind: 'hand-held', performerId, hand: 'right' } },
          { ballId: asBallId('ball-2'), location: { kind: 'hand-back', positionId: rightBack, performerId, hand: 'right' } },
        ],
      },
      notation: [entry('bounce-balanced', 'right', {
        type: 'BOUNCE',
        target: { kind: 'position', positionId: positionA },
      })],
    };

    expect(simulateSequence(sequence).validation.isValid).toBe(true);
  });

  it('rejects an invalid initial distribution', () => {
    expect(validateSequence(invalidInitialStateSequence).isValid).toBe(false);
    expect(validateSequence(invalidInitialStateSequence).issues.map((item) => item.code)).toContain('initial-position-capacity');
  });

  it('does not partially apply conflicting simultaneous actions', () => {
    const sequence: Sequence = {
      ...representativeSoloSequence,
      notation: [
        entry('lift-right', 'right', { type: 'LIFT', target: { kind: 'position', positionId: positionA } }),
        entry('lift-left', 'left', { type: 'LIFT', target: { kind: 'position', positionId: positionA } }),
      ],
    };
    const result = simulateSequence(sequence);
    expect(result.validation.isValid).toBe(false);
    expect(result.validation.issues.map((item) => item.code)).toContain('conflicting-position-actions');
    expect(result.snapshots[1]?.ballLocations[asBallId('ball-1')]).toEqual({
      kind: 'position',
      positionId: positionA,
    });
  });

  it('produces the same state regardless of notation entry order', () => {
    const sequence: Sequence = {
      ...representativeSoloSequence,
      balls: [...representativeSoloSequence.balls, { id: asBallId('ball-2') }],
      initialState: {
        placements: [
          { ballId: asBallId('ball-1'), location: { kind: 'position', positionId: positionA } },
          { ballId: asBallId('ball-2'), location: { kind: 'position', positionId: positionC } },
        ],
      },
      notation: [
        entry('lift-right-a', 'right', { type: 'LIFT', target: { kind: 'position', positionId: positionA } }),
        entry('lift-left-c', 'left', { type: 'LIFT', target: { kind: 'position', positionId: positionC } }),
      ],
    };
    const forward = simulateSequence(sequence);
    const reversed = simulateSequence({ ...sequence, notation: [...sequence.notation].reverse() });

    expect(forward.validation.isValid).toBe(true);
    expect(reversed).toEqual(forward);
    expect(forward.snapshots[1]?.handStates[performerId]?.right.heldBallId).toBe('ball-1');
    expect(forward.snapshots[1]?.handStates[performerId]?.left.heldBallId).toBe('ball-2');
  });

  it('moves a ball between hands through a paired ZIP', () => {
    const sequence: Sequence = {
      ...representativeSoloSequence,
      initialState: {
        placements: [{
          ballId: asBallId('ball-1'),
          location: { kind: 'hand-held', performerId, hand: 'right' },
        }],
      },
      notation: [
        entry('zip-source', 'right', { type: 'ZIP', role: 'source', linkId: asLinkId('zip-1') }),
        entry('zip-receiver', 'left', { type: 'ZIP', role: 'receiver', linkId: asLinkId('zip-1') }),
      ],
    };
    const result = simulateSequence(sequence);
    expect(result.validation.isValid).toBe(true);
    expect(result.snapshots[1]?.handStates[performerId]?.left.heldBallId).toBe('ball-1');
    expect(result.snapshots[1]?.handStates[performerId]?.right.heldBallId).toBeNull();
  });
});
