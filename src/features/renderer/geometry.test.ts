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
  getPassMeetingPoint,
  getPerformerAnchor,
  getPerformerSpacingRadius,
  getTableFootprint,
  getTablePositionPosition,
  isStationaryHandAction,
} from './geometry';

function sequence(
  performerCount = 1,
  tableLayout: Sequence['tableLayout'] = { type: 'solo' },
  seatAssignments: Sequence['seatAssignments'] = [],
): Sequence {
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
    tableLayout,
    seatAssignments,
  };
}

describe('renderer geometry', () => {
  it('keeps HOLD and EMPTY as stationary hand actions', () => {
    expect(isStationaryHandAction('HOLD')).toBe(true);
    expect(isStationaryHandAction('EMPTY')).toBe(true);
    expect(isStationaryHandAction('BOUNCE')).toBe(false);
    expect(isStationaryHandAction('TAP')).toBe(false);
  });

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

  it('keeps rectangular table positions separated across all performer seats', () => {
    const base = sequence(6, { type: 'rectangle', longSideSeatCount: 3, shortSideSeatCount: 0 });
    const positions = base.performers.flatMap((performer) => ['A', 'B', 'C'].map((name) => ({
      id: asPositionId(name + '-' + performer.id),
      kind: 'table' as const,
      name,
      owner: { kind: 'performer' as const, performerId: performer.id },
    })));
    const seatAssignments = base.performers.map((performer, index) => ({
      performerId: performer.id,
      seat: {
        kind: 'rectangle-side' as const,
        side: (index % 2 === 0 ? 'long-a' : 'long-b') as 'long-a' | 'long-b',
        seatIndex: Math.floor(index / 2),
      },
    }));
    const value = { ...base, positions, seatAssignments };
    const points = positions.map((position) => getTablePositionPosition(value, position, 'circle'));
    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const distance = Math.hypot(points[i]!.x - points[j]!.x, points[i]!.z - points[j]!.z);
        expect(distance).toBeGreaterThan(0.4);
      }
    }
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

  it('uses the configured polygon side count for circle passing projections', () => {
    const value = { ...sequence(10, { type: 'polygon', sideCount: 10 }), sequenceType: 'circle-passing' as const };
    const footprint = getTableFootprint(value);
    expect(footprint.round).toBe(true);
    expect(footprint.sideCount).toBe(value.performers.length);
  });

  it('gives three circle participants nine distinct table positions', () => {
    const base = sequence(3, { type: 'polygon', sideCount: 3 });
    const positions = base.performers.flatMap((performer) => ['A', 'B', 'C'].map((name) => ({
      id: asPositionId(name + '-' + performer.id),
      kind: 'table' as const,
      name,
      owner: { kind: 'performer' as const, performerId: performer.id },
    })));
    const value = { ...base, sequenceType: 'circle-passing' as const, positions };
    const points = positions.map((position) => getTablePositionPosition(value, position, 'circle'));
    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const distance = Math.hypot(points[i]!.x - points[j]!.x, points[i]!.z - points[j]!.z);
        expect(distance).toBeGreaterThan(0.4);
      }
    }
  });

  it('keeps owned positions distinct along a circle table edge', () => {
    const value = { ...sequence(10, { type: 'polygon', sideCount: 10 }), sequenceType: 'circle-passing' as const };
    const performer = value.performers[0]!;
    const positions = ['A', 'B', 'C'].map((name) => ({
      id: asPositionId('position-' + name),
      kind: 'table' as const,
      name,
      owner: { kind: 'performer' as const, performerId: performer.id },
    }));
    const configured = { ...value, positions };
    const points = positions.map((position) => getTablePositionPosition(configured, position, 'circle'));
    expect(Math.hypot(points[0]!.x - points[1]!.x, points[0]!.z - points[1]!.z)).toBeGreaterThanOrEqual(0.7);
    expect(Math.hypot(points[1]!.x - points[2]!.x, points[1]!.z - points[2]!.z)).toBeGreaterThanOrEqual(0.7);
  });

  it.each(Array.from({ length: 18 }, (_, index) => index + 3))(
    'keeps all three positions per edge separated for %i polygon participants',
    (participantCount) => {
      const base = sequence(participantCount, { type: 'polygon', sideCount: participantCount });
      const positions = base.performers.flatMap((performer) => ['A', 'B', 'C'].map((name) => ({
        id: asPositionId(name + '-' + performer.id),
        kind: 'table' as const,
        name,
        owner: { kind: 'performer' as const, performerId: performer.id },
      })));
      const value = { ...base, sequenceType: 'circle-passing' as const, positions };
      const points = positions.map((position) => getTablePositionPosition(value, position, 'circle'));
      for (let i = 0; i < points.length; i += 1) {
        for (let j = i + 1; j < points.length; j += 1) {
          const distance = Math.hypot(points[i]!.x - points[j]!.x, points[i]!.z - points[j]!.z);
          expect(distance).toBeGreaterThan(0.4);
        }
      }
    },
  );

  it('places circle performers close to the table without overlapping neighbours', () => {
    const value = { ...sequence(10, { type: 'polygon', sideCount: 10 }), sequenceType: 'circle-passing' as const };
    const anchors = value.performers.map((performer) => getPerformerAnchor(value, performer, 'circle'));
    const neighbourDistances = anchors.map((point, index) => {
      const next = anchors[(index + 1) % anchors.length]!;
      return Math.hypot(point.x - next.x, point.z - next.z);
    });
    expect(Math.min(...neighbourDistances)).toBeGreaterThan(0.76);
    const firstPosition = value.positions[0]!;
    const tablePoint = getTablePositionPosition(value, firstPosition, 'circle');
    const firstAnchor = getPerformerAnchor(value, value.performers[0]!, 'circle');
    expect(Math.hypot(firstAnchor.x - tablePoint.x, firstAnchor.z - tablePoint.z)).toBeLessThan(1.7);
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

  it('gives both passing hands the same intermediate meeting point', () => {
    const value = sequence(2);
    const source = getHandPosition(value, 'a', 'left', 'circle');
    const recipient = getHandPosition(value, 'b', 'right', 'circle');
    const meeting = getPassMeetingPoint(value, 'a', 'left', 'b', 'right', 'circle');
    expect(meeting.x).toBeCloseTo((source.x + recipient.x) / 2);
    expect(meeting.y).toBeCloseTo((source.y + recipient.y) / 2);
    expect(meeting.z).toBeCloseTo((source.z + recipient.z) / 2);
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
