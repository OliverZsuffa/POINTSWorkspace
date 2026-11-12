import { describe, expect, it } from 'vitest';
import { asPerformerId, asPositionId, asSequenceId } from '../../domain/ids';
import { DEFAULT_TIME_SIGNATURE } from '../../domain/time/time-signature';
import type { Sequence } from '../../domain/model';
import {
  getCameraPanOffset,
  getHandPosition,
  getHandReachPosition,
  getHandReachProgress,
  getObjectPosition,
  getPerformerAnchor,
  getPerformerSpacingRadius,
  getTableFootprint,
  getTablePositionPosition,
} from './geometry';

function sequence(\n  performerCount = 1,\n  tableLayout: Sequence['tableLayout'] = { type: 'solo' },\n  seatAssignments: Sequence['seatAssignments'] = [],\n): Sequence {
  const performers = Array.from({ length: performerCount }, (_, index) => ({
    id: asPerformerId(String.fromCharCode(97 + index)),
    name: `Performer ${index + 1}`,
    identifier: String.fromCharCode(97 + index),
  }));
  const firstPerformer = performers[0]!;
  return {
    id: asSequenceId('test'),
    sequenceType: 'solo',
    timeSignature: DEFAULT_TIME_SIGNATURE,
    bpm: 120,
    beats: [{ id: 'beat-1' as Sequence['beats'][number]['id'], subdivisions: [] }],
    performers,
    positions: [{
      id: asPositionId('A-a'),
      kind: 'table',
      name: 'A',
      owner: { kind: 'performer', performerId: firstPerformer.id },
    }],
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

  it('keeps performer owned table positions on the tabletop footprint', () => {
    const value = sequence();
    const footprint = getTableFootprint(value);
    const point = getTablePositionPosition(value, value.positions[0]!, 'circle');
    expect(Math.abs(point.x)).toBeLessThanOrEqual(footprint.width / 2);
    expect(Math.abs(point.z)).toBeLessThanOrEqual(footprint.depth / 2);
    expect(point.y).toBeGreaterThan(0);
  });

  it('aligns rectangle table positions with the assigned seat edge', () => {
    const performerId = asPerformerId('a');
    const value = sequence(1, { type: 'rectangle', longSideSeatCount: 2, shortSideSeatCount: 1 }, [
      { performerId, seat: { kind: 'rectangle-side', side: 'long-b', seatIndex: 0 } },
    ]);
    const footprint = getTableFootprint(value);
    const point = getTablePositionPosition(value, value.positions[0]!, 'circle');
    expect(Math.abs(point.x)).toBeLessThanOrEqual(footprint.width / 2);
    expect(Math.abs(point.z)).toBeLessThanOrEqual(footprint.depth / 2);
    expect(point.x).toBeLessThan(0);
    expect(point.z).toBeGreaterThan(0);
  });

  it('keeps polygon table positions inside every polygon edge', () => {
    const performerId = asPerformerId('a');
    const sideCount = 5;
    const value = sequence(1, { type: 'polygon', sideCount }, [
      { performerId, seat: { kind: 'polygon-edge', edgeIndex: 0 } },
    ]);
    const footprint = getTableFootprint(value);
    const point = getTablePositionPosition(value, value.positions[0]!, 'circle');
    const apothem = (footprint.width / 2) * Math.cos(Math.PI / sideCount);
    for (let edge = 0; edge < sideCount; edge += 1) {
      const angle = Math.PI / 2 + ((edge + 0.5) * Math.PI * 2) / sideCount;
      const distance = point.x * Math.cos(angle) + point.z * Math.sin(angle);
      expect(distance).toBeLessThanOrEqual(apothem + 1e-9);
    }
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

  it('expands the automatic circle to maintain minimum performer separation', () => {
    const value = sequence(12);
    const anchors = value.performers.map((performer) => getPerformerAnchor(value, performer, 'circle'));
    const distances = anchors.map((anchor, index) => {
      const next = anchors[(index + 1) % anchors.length]!;
      return Math.hypot(anchor.x - next.x, anchor.z - next.z);
    });
    expect(Math.min(...distances)).toBeGreaterThanOrEqual(2.2 - 1e-9);
  });

  it('uses the full circumference efficiently for automatic performer placement', () => {
    const count = 10;
    const radius = getPerformerSpacingRadius(count);
    const expectedDistance = 2 * radius * Math.sin(Math.PI / count);
    expect(expectedDistance).toBeGreaterThanOrEqual(2.2 - 1e-9);
    expect(getPerformerSpacingRadius(count)).toBe(radius);
  });

  it('reaches an action target exactly halfway through the beat and returns to rest', () => {
    const base = { x: 1, y: 1, z: 1 };
    const target = { x: 4, y: 0.2, z: -2 };
    expect(getHandReachProgress(0)).toBeCloseTo(0);
    const reached = getHandReachPosition(base, target, 0.5);
    expect(reached.x).toBeCloseTo(target.x);
    expect(reached.y).toBeCloseTo(target.y);
    expect(reached.z).toBeCloseTo(target.z);
    expect(getHandReachPosition(base, target, 1)).toEqual(base);
    expect(getHandReachPosition(base, target, -1)).toEqual(base);
  });

  it('pans opposite the camera local right vector so the scene follows the pointer', () => {
    const offset = getCameraPanOffset(
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      100,
      0,
      10,
    );
    expect(offset.x).toBeLessThan(0);
    expect(offset.y).toBe(0);
    expect(offset.z).toBe(0);
  });
});
