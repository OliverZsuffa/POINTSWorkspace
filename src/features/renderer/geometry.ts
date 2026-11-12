import type { ObjectLocation, Performer, PositionDefinition, Sequence } from '../../domain/model';

export type SceneLayout = 'circle' | 'line';

export interface Point3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

const ZERO: Point3 = { x: 0, y: 0, z: 0 };

function add(a: Point3, b: Point3): Point3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function scale(point: Point3, factor: number): Point3 {
  return { x: point.x * factor, y: point.y * factor, z: point.z * factor };
}

function normalize(point: Point3): Point3 {
  const length = Math.hypot(point.x, point.z) || 1;
  return { x: point.x / length, y: 0, z: point.z / length };
}

export function getHandReachProgress(progress: number): number {
  const clamped = Math.max(0, Math.min(1, progress));
  if (clamped === 0 || clamped === 1) return 0;
  return Math.sin(clamped * Math.PI);
}

export function getHandReachPosition(base: Point3, target: Point3, progress: number): Point3 {
  const amount = getHandReachProgress(progress);
  return add(base, scale({ x: target.x - base.x, y: target.y - base.y, z: target.z - base.z }, amount));
}

export function getCameraPanOffset(
  cameraRight: Point3,
  cameraUp: Point3,
  deltaX: number,
  deltaY: number,
  radius: number,
): Point3 {
  const factor = Math.max(0, radius) * 0.0018;
  return add(scale(cameraRight, -deltaX * factor), scale(cameraUp, deltaY * factor));
}

function positionOffset(name: string): number {
  if (name === 'A') return -0.95;
  if (name === 'C') return 0.95;
  return 0;
}

export function getPerformerSpacingRadius(count: number, minimumDistance = 2.2): number {
  const safeCount = Math.max(1, Math.floor(count));
  if (safeCount <= 1) return 3.7;
  return Math.max(3.7, minimumDistance / (2 * Math.sin(Math.PI / safeCount)));
}

export function getPerformerAnchor(
  sequence: Sequence,
  performer: Performer,
  layout: SceneLayout,
): Point3 {
  const index = sequence.performers.findIndex((item) => item.id === performer.id);
  const count = Math.max(1, sequence.performers.length);

  if (layout === 'line') {
    return { x: (index - (count - 1) / 2) * 2.8, y: 0, z: 4 };
  }

  const assignment = sequence.seatAssignments.find((item) => item.performerId === performer.id);
  if (assignment?.seat.kind === 'polygon-edge' && sequence.tableLayout.type === 'polygon') {
    const sideCount = Math.max(3, sequence.tableLayout.sideCount);
    const angle = (Math.PI / 2) + ((assignment.seat.edgeIndex + 0.5) * Math.PI * 2) / sideCount;
    const tableRadius = Math.max(1.6, sideCount * 0.36);
    const radius = tableRadius + 2.2;
    return { x: Math.cos(angle) * radius, y: 0, z: Math.sin(angle) * radius };
  }

  if (assignment?.seat.kind === 'rectangle-side' && sequence.tableLayout.type === 'rectangle') {
    const width = Math.max(3.2, sequence.tableLayout.longSideSeatCount * 1.15);
    const depth = Math.max(2.4, sequence.tableLayout.shortSideSeatCount * 1.15);
    const seat = assignment.seat;
    if (seat.side === 'long-a' || seat.side === 'long-b') {
      const countOnSide = Math.max(1, sequence.tableLayout.longSideSeatCount);
      const x = countOnSide === 1 ? 0 : -width / 2 + (seat.seatIndex * width) / (countOnSide - 1);
      return { x, y: 0, z: (seat.side === 'long-a' ? -1 : 1) * (depth / 2 + 2.2) };
    }
    const countOnSide = Math.max(1, sequence.tableLayout.shortSideSeatCount);
    const z = countOnSide === 1 ? 0 : -depth / 2 + (seat.seatIndex * depth) / (countOnSide - 1);
    return { x: (seat.side === 'short-a' ? -1 : 1) * (width / 2 + 2.2), y: 0, z };
  }

  const angle = (Math.PI / 2) + (index * Math.PI * 2) / count;
  const radius = getPerformerSpacingRadius(count);
  return { x: Math.cos(angle) * radius, y: 0, z: Math.sin(angle) * radius };
}

export function getPerformerFacing(
  sequence: Sequence,
  performer: Performer,
  layout: SceneLayout,
): Point3 {
  return normalize(scale(getPerformerAnchor(sequence, performer, layout), -1));
}

export function getHandPosition(
  sequence: Sequence,
  performerId: string,
  hand: 'left' | 'right',
  layout: SceneLayout,
): Point3 {
  const performer = sequence.performers.find((item) => item.id === performerId);
  if (!performer) return ZERO;
  const anchor = getPerformerAnchor(sequence, performer, layout);
  const facing = getPerformerFacing(sequence, performer, layout);
  const right = { x: -facing.z, y: 0, z: facing.x };
  const side = hand === 'left' ? -1 : 1;
  return add(add(anchor, scale(right, side * 0.58)), add(scale(facing, 0.28), { x: 0, y: 1.05, z: 0 }));
}

export function getTableFootprint(sequence: Sequence): { width: number; depth: number; round: boolean; sideCount?: number } {
  if (sequence.tableLayout.type === 'rectangle') {
    const width = Math.max(3.2, sequence.tableLayout.longSideSeatCount * 1.15);
    const depth = Math.max(2.4, sequence.tableLayout.shortSideSeatCount * 1.15);
    return { width, depth, round: false };
  }
  if (sequence.tableLayout.type === 'polygon') {
    const sideCount = Math.max(3, sequence.tableLayout.sideCount);
    const diameter = Math.max(3.2, sideCount * 0.72);
    return { width: diameter, depth: diameter, round: true, sideCount };
  }
  return { width: 3.6, depth: 2.5, round: false };
}

export function getTablePositionPosition(
  sequence: Sequence,
  position: PositionDefinition,
  layout: SceneLayout,
): Point3 {
  if (position.kind !== 'table') return ZERO;
  const footprint = getTableFootprint(sequence);
  const owner = position.owner;

  if (owner.kind === 'shared') {
    return { x: positionOffset(position.name), y: 0.19, z: 0 };
  }

  const performer = sequence.performers.find((item) => item.id === owner.performerId);
  if (!performer) return ZERO;
  const assignment = sequence.seatAssignments.find((item) => item.performerId === performer.id);
  const inwardOffset = 0.42;

  if (assignment?.seat.kind === 'rectangle-side' && sequence.tableLayout.type === 'rectangle') {
    const width = footprint.width;
    const depth = footprint.depth;
    const seat = assignment.seat;
    if (seat.side === 'long-a' || seat.side === 'long-b') {
      const countOnSide = Math.max(1, sequence.tableLayout.longSideSeatCount);
      const seatX = countOnSide === 1 ? 0 : -width / 2 + (seat.seatIndex * width) / (countOnSide - 1);
      return {
        x: Math.max(-width / 2 + 0.2, Math.min(width / 2 - 0.2, seatX + positionOffset(position.name))),
        y: 0.19,
        z: (seat.side === 'long-a' ? -1 : 1) * (depth / 2 - inwardOffset),
      };
    }
    const countOnSide = Math.max(1, sequence.tableLayout.shortSideSeatCount);
    const seatZ = countOnSide === 1 ? 0 : -depth / 2 + (seat.seatIndex * depth) / (countOnSide - 1);
    return {
      x: (seat.side === 'short-a' ? -1 : 1) * (width / 2 - inwardOffset),
      y: 0.19,
      z: Math.max(-depth / 2 + 0.2, Math.min(depth / 2 - 0.2, seatZ + positionOffset(position.name))),
    };
  }

  if (assignment?.seat.kind === 'polygon-edge' && sequence.tableLayout.type === 'polygon') {
    const sideCount = Math.max(3, sequence.tableLayout.sideCount);
    const radius = footprint.width / 2;
    const angle = (Math.PI / 2) + ((assignment.seat.edgeIndex + 0.5) * Math.PI * 2) / sideCount;
    const normal = { x: Math.cos(angle), y: 0, z: Math.sin(angle) };
    const tangent = { x: -normal.z, y: 0, z: normal.x };
    const apothem = radius * Math.cos(Math.PI / sideCount);
    const maxOffset = Math.max(0, radius * Math.sin(Math.PI / sideCount) - 0.2);
    const tangentOffset = Math.max(-maxOffset, Math.min(maxOffset, positionOffset(position.name)));
    return add(
      scale(normal, apothem - inwardOffset),
      add(scale(tangent, tangentOffset), { x: 0, y: 0.19, z: 0 }),
    );
  }

  const anchor = getPerformerAnchor(sequence, performer, layout);
  const direction = normalize(anchor);
  let edgeDistance: number;
  let maximumTangentOffset: number;
  if (footprint.round) {
    const sideCount = footprint.sideCount ?? 48;
    const radius = footprint.width / 2;
    edgeDistance = radius * Math.cos(Math.PI / sideCount);
    maximumTangentOffset = radius * Math.sin(Math.PI / sideCount) - 0.2;
  } else {
    const xDistance = Math.abs(direction.x) > 0.0001 ? (footprint.width / 2) / Math.abs(direction.x) : Number.POSITIVE_INFINITY;
    const zDistance = Math.abs(direction.z) > 0.0001 ? (footprint.depth / 2) / Math.abs(direction.z) : Number.POSITIVE_INFINITY;
    edgeDistance = Math.min(xDistance, zDistance);
    maximumTangentOffset = (xDistance < zDistance ? footprint.depth : footprint.width) / 2 - 0.2;
  }

  const edgePoint = scale(direction, Math.max(0, edgeDistance - inwardOffset));
  const tangent = { x: -direction.z, y: 0, z: direction.x };
  const tangentOffset = Math.max(-maximumTangentOffset, Math.min(maximumTangentOffset, positionOffset(position.name)));
  return add(edgePoint, add(scale(tangent, tangentOffset), { x: 0, y: 0.19, z: 0 }));
}

export function getObjectPosition(
  sequence: Sequence,
  location: ObjectLocation | undefined,
  layout: SceneLayout,
): Point3 {
  if (!location) return { x: 0, y: 0.35, z: 0 };
  if (location.kind === 'position') {
    const position = sequence.positions.find((item) => item.id === location.positionId);
    return position ? getTablePositionPosition(sequence, position, layout) : ZERO;
  }
  const hand = getHandPosition(sequence, location.performerId, location.hand, layout);
  return location.kind === 'hand-back' ? { ...hand, y: hand.y + 0.18 } : hand;
}
