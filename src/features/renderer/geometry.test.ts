import { describe, expect, it } from 'vitest';
import { asPerformerId, asPositionId, asSequenceId } from '../../domain/ids';
import { DEFAULT_TIME_SIGNATURE } from '../../domain/time/time-signature';
import type { Sequence } from '../../domain/model';
import {
  getHandPosition,
  getObjectPosition,
  getPerformerAnchor,
  getTablePositionPosition,
} from './geometry';

function sequence(): Sequence {
  const performerId = asPerformerId('a');
  const positionId = asPositionId('A-a');
  return {
    id: asSequenceId('test'),
    sequenceType: 'solo',
    timeSignature: DEFAULT_TIME_SIGNATURE,
    bpm: 120,
    beats: [{ id: 'beat-1' as Sequence['beats'][number]['id'], subdivisions: [] }],
    performers: [{ id: performerId, name: 'A', identifier: 'a' }],
    positions: [{ id: positionId, kind: 'table', name: 'A', owner: { kind: 'performer', performerId } }],
    balls: [],
    initialState: { placements: [] },
    notation: [],
    tableLayout: { type: 'solo' },
    seatAssignments: [],
  };
}

describe('renderer geometry', () => {
  it('places a solo performer opposite their table positions', () => {
    const value = sequence();
    const performer = value.performers[0]!;
    const anchor = getPerformerAnchor(value, performer, 'circle');
    const position = getTablePositionPosition(value, value.positions[0]!, 'circle');
    expect(anchor.z).toBeGreaterThan(0);
    expect(position.z).toBeLessThan(anchor.z);
  });

  it('places left and right hands on opposite sides', () => {
    const value = sequence();
    const left = getHandPosition(value, 'a', 'left', 'circle');
    const right = getHandPosition(value, 'a', 'right', 'circle');
    expect(left.x).not.toBe(right.x);
    expect(left.y).toBe(right.y);
  });

  it('maps held objects to the owning hand', () => {
    const value = sequence();
    const position = getHandPosition(value, 'a', 'left', 'circle');
    const object = getObjectPosition(value, { kind: 'hand-held', performerId: asPerformerId('a'), hand: 'left' }, 'circle');
    expect(object).toEqual(position);
  });
});
