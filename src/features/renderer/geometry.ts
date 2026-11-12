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

  const angle = (Math.PI / 2) + (index * Math.PI * 2) / count;
  return { x: Math.cos(angle) * 3.7, y: 0, z: Math.sin(angle) * 3.7 };
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

function positionOffset(name: string): number {
  if (name === 'A') return -0.95;
  if (name === 'C') return 0.95;
  return 0;
}

export function getTablePositionPosition(
  sequence: Sequence,
  position: PositionDefinition,
  layout: SceneLayout,
): Point3 {
  if (position.kind !== 'table') return ZERO;
  if (position.owner.kind === 'shared') {
    return { x: positionOffset(position.name), y: 0.16, z: 0 };
  }

  const performer = sequence.performers.find((item) => item.id === position.owner.performerId);
  if (!performer) return ZERO;
  const anchor = getPerformerAnchor(sequence, performer, layout);
  const facing = getPerformerFacing(sequence, performer, layout);
  const right = { x: -facing.z, y: 0, z: facing.x };
  return add(add(anchor, scale(facing, 1.9)), add(scale(right, positionOffset(position.name)), { x: 0, y: 0.16, z: 0 }));
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

export function getTableFootprint(sequence: Sequence): { width: number; depth: number; round: boolean } {
  if (sequence.tableLayout.type === 'rectangle') {
    const width = Math.max(3.2, sequence.tableLayout.longSideSeatCount * 1.15);
    const depth = Math.max(2.4, sequence.tableLayout.shortSideSeatCount * 1.15);
    return { width, depth, round: false };
  }
  if (sequence.tableLayout.type === 'polygon') {
    const sideCount = Math.max(3, sequence.tableLayout.sideCount);
    const diameter = Math.max(3.2, sideCount * 0.72);
    return { width: diameter, depth: diameter, round: true };
  }
  return { width: 3.6, depth: 2.5, round: false };
}
