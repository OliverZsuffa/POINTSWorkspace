import type { ActionEntryId, BallId, Hand, HandObjectState, PerformerId, PositionId } from '../ids';
import type {
  NotationEntry,
  ObjectLocation,
  ObjectStateSnapshot,
  Sequence,
  SimulationResult,
  TimelinePosition,
  ValidationIssue,
} from '../model';
import { rational } from '../time/rational';

type State = Map<BallId, ObjectLocation>;
type Target = Extract<NotationEntry['action'], { type: 'LIFT' | 'LEAVE' | 'TAP' | 'BOUNCE' }>['target'];

const key = (location: ObjectLocation): string => {
  if (location.kind === 'position') return 'p:' + location.positionId;
  return (location.kind === 'hand-held' ? 'h:' : 'b:') + location.performerId + ':' + location.hand;
};

const held = (state: State, performerId: PerformerId, hand: Hand) =>
  findBall(state, { kind: 'hand-held', performerId, hand });

function findBall(state: State, location: ObjectLocation): BallId | undefined {
  for (const [id, current] of state) if (key(current) === key(location)) return id;
  return undefined;
}

function problem(
  code: string,
  description: string,
  entries: readonly NotationEntry[] = [],
  positions: readonly PositionId[] = [],
  at?: TimelinePosition,
): ValidationIssue {
  return {
    code,
    severity: 'error',
    description,
    affectedEntries: entries.map((entry) => entry.id),
    ...(positions.length ? { affectedPositions: positions } : {}),
    ...(at ? { at } : entries[0] ? { at: entries[0].time } : {}),
  };
}

function resolvePosition(sequence: Sequence, performerId: PerformerId, target: Target): PositionId | undefined {
  if (target.kind === 'position') {
    return sequence.positions.some((position) => position.kind === 'table' && position.id === target.positionId)
      ? target.positionId
      : undefined;
  }
  if (target.kind !== 'circle-position' || sequence.sequenceType !== 'circle-passing') return undefined;
  const index = sequence.performers.findIndex((performer) => performer.id === performerId);
  if (index < 0 || sequence.performers.length < 2 || !Number.isSafeInteger(target.distance) || target.distance < 1) return undefined;
  const direction = target.direction === 'left' ? -1 : 1;
  const count = sequence.performers.length;
  const targetPerformer = sequence.performers[((index + direction * target.distance) % count + count) % count];
  if (!targetPerformer) return undefined;
  return sequence.positions.find((position) =>
    position.kind === 'table' &&
    position.name === target.position &&
    position.owner.kind === 'performer' &&
    position.owner.performerId === targetPerformer.id,
  )?.id;
}

function initialState(sequence: Sequence): { state: State; issues: ValidationIssue[] } {
  const state: State = new Map();
  const issues: ValidationIssue[] = [];
  const balls = new Set(sequence.balls.map((ball) => ball.id));
  const positions = new Map(sequence.positions.map((position) => [position.id, position]));
  const placed = new Set<BallId>();
  const occupied = new Set<string>();

  if (balls.size !== sequence.balls.length) issues.push(problem('duplicate-ball-id', 'Ball identifiers must be unique.'));

  for (const placement of sequence.initialState.placements) {
    const { ballId, location } = placement;
    if (!balls.has(ballId)) {
      issues.push(problem('unknown-ball', 'Initial state references unknown ball "' + ballId + '".'));
      continue;
    }
    if (placed.has(ballId)) {
      issues.push(problem('duplicate-ball-placement', 'Ball "' + ballId + '" has multiple initial placements.'));
      continue;
    }

    let valid = false;
    if (location.kind === 'position') {
      valid = positions.get(location.positionId)?.kind === 'table';
      if (!valid) issues.push(problem('invalid-initial-position', 'Initial position is unknown or is not a table position.', [], [location.positionId]));
    } else if (location.kind === 'hand-held') {
      valid = sequence.performers.some((performer) => performer.id === location.performerId);
      if (!valid) issues.push(problem('unknown-performer', 'Initial state references an unknown performer.'));
    } else {
      const position = positions.get(location.positionId);
      valid = position?.kind === 'hand-back' &&
        position.performerId === location.performerId &&
        position.hand === location.hand &&
        sequence.performers.some((performer) => performer.id === location.performerId);
      if (!valid) issues.push(problem('invalid-initial-hand-back', 'Initial hand-back placement does not match a defined hand-back position.', [], [location.positionId]));
    }

    if (!valid) continue;
    const locationId = key(location);
    if (occupied.has(locationId)) {
      issues.push(problem('initial-position-capacity', 'More than one ball occupies the same initial position.'));
      continue;
    }
    occupied.add(locationId);
    placed.add(ballId);
    state.set(ballId, location);
  }

  for (const ball of sequence.balls) {
    if (!placed.has(ball.id)) issues.push(problem('unplaced-ball', 'Ball "' + ball.id + '" has no initial placement.'));
  }
  return { state, issues };
}

function makeSnapshot(
  sequence: Sequence,
  state: State,
  at: TimelinePosition,
  phase: 'before' | 'after',
): ObjectStateSnapshot {
  const hands: Record<string, { left: HandObjectState; right: HandObjectState }> = {};
  for (const performer of sequence.performers) {
    hands[performer.id] = {
      left: { heldBallId: null, balancedBallId: null },
      right: { heldBallId: null, balancedBallId: null },
    };
  }
  const ballLocations = Object.fromEntries(state) as Record<BallId, ObjectLocation>;
  for (const [ballId, location] of state) {
    if (location.kind === 'hand-held') {
      const hand = hands[location.performerId];
      if (hand) hand[location.hand].heldBallId = ballId;
    } else if (location.kind === 'hand-back') {
      const hand = hands[location.performerId];
      if (hand) hand[location.hand].balancedBallId = ballId;
    }
  }
  return { at, phase, ballLocations, handStates: hands };
}

function evaluateBeat(sequence: Sequence, entries: readonly NotationEntry[], state: State): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const handActions = new Map<string, NotationEntry>();
  const links = new Map<string, NotationEntry[]>();
  const transfers = new Map<BallId, ObjectLocation>();
  const accessedPositions = new Set<PositionId>();

  const transfer = (ballId: BallId, destination: ObjectLocation, entriesForIssue: readonly NotationEntry[]) => {
    if (transfers.has(ballId)) {
      issues.push(problem('duplicate-ball-transfer', 'An object cannot be transferred more than once in one beat.', entriesForIssue));
    } else {
      transfers.set(ballId, destination);
    }
  };

  for (const entry of entries) {
    if (!sequence.performers.some((performer) => performer.id === entry.performerId)) {
      issues.push(problem('unknown-action-performer', 'Action references an unknown performer.', [entry]));
    }
    const handId = String(entry.performerId) + ':' + entry.hand;
    const previous = handActions.get(handId);
    if (previous) issues.push(problem('multiple-actions-per-hand', 'A hand cannot perform more than one action in the same beat.', [previous, entry]));
    else handActions.set(handId, entry);

    if ('linkId' in entry.action && entry.action.linkId) {
      const group = links.get(entry.action.linkId) ?? [];
      group.push(entry);
      links.set(entry.action.linkId, group);
    }
  }

  const linkedEntries = new Set<ActionEntryId>();
  for (const [linkId, group] of links) {
    const zip = group.filter((entry) => entry.action.type === 'ZIP');
    const pass = group.filter((entry) =>
      (entry.action.type === 'LEAVE' && entry.action.target.kind === 'pass-recipient-hand') ||
      (entry.action.type === 'LIFT' && entry.action.target.kind === 'pass-source'),
    );
    const special = group.filter((entry) => entry.action.type === 'SPECIAL');

    if (zip.length === 2 && zip.length === group.length) {
      const source = zip.find((entry) => entry.action.type === 'ZIP' && entry.action.role === 'source');
      const receiver = zip.find((entry) => entry.action.type === 'ZIP' && entry.action.role === 'receiver');
      if (
        source?.action.type !== 'ZIP' ||
        receiver?.action.type !== 'ZIP' ||
        source.performerId !== receiver.performerId ||
        source.hand === receiver.hand
      ) {
        issues.push(problem('invalid-zip-pair', 'ZIP link "' + linkId + '" must connect opposite hands of one performer.', group));
      } else {
        const ballId = held(state, source.performerId, source.hand);
        if (!ballId) issues.push(problem('zip-source-empty', 'ZIP source hand is empty.', group));
        else if (held(state, receiver.performerId, receiver.hand)) issues.push(problem('zip-receiver-occupied', 'ZIP receiver hand is occupied.', group));
        else transfer(ballId, { kind: 'hand-held', performerId: receiver.performerId, hand: receiver.hand }, group);
      }
    } else if (pass.length === 2 && pass.length === group.length) {
      const sender = pass.find((entry) => entry.action.type === 'LEAVE' && entry.action.target.kind === 'pass-recipient-hand');
      const receiver = pass.find((entry) => entry.action.type === 'LIFT' && entry.action.target.kind === 'pass-source');
      if (
        sender?.action.type !== 'LEAVE' ||
        sender.action.target.kind !== 'pass-recipient-hand' ||
        receiver?.action.type !== 'LIFT' ||
        receiver.action.target.kind !== 'pass-source' ||
        sender.performerId === receiver.performerId ||
        sender.action.target.performerId !== receiver.performerId ||
        sender.action.target.hand !== receiver.hand ||
        receiver.action.target.performerId !== sender.performerId
      ) {
        issues.push(problem('invalid-individual-pass-pair', 'Passing link "' + linkId + '" must connect one sender LEAVE and one reciprocal receiver LIFT.', group));
      } else {
        const ballId = held(state, sender.performerId, sender.hand);
        if (!ballId) issues.push(problem('pass-source-empty', 'Passing sender hand is empty.', group));
        else if (held(state, receiver.performerId, receiver.hand)) issues.push(problem('pass-receiver-occupied', 'Passing receiver hand is occupied.', group));
        else transfer(ballId, { kind: 'hand-held', performerId: receiver.performerId, hand: receiver.hand }, group);
      }
    } else if (special.length === 2 && special.length === group.length) {
      const first = special[0];
      const second = special[1];
      if (!first || !second || first.performerId !== second.performerId || first.hand === second.hand ||
        first.action.type !== 'SPECIAL' || second.action.type !== 'SPECIAL' || first.action.text !== second.action.text) {
        issues.push(problem('invalid-linked-special', 'Linked SPECIAL actions must match across both hands of one performer.', group));
      } else if (held(state, first.performerId, first.hand) || held(state, second.performerId, second.hand)) {
        issues.push(problem('special-hand-occupied', 'SPECIAL requires free fingers in both hands.', group));
      }
    } else {
      issues.push(problem('invalid-action-link', 'Action link "' + linkId + '" is incomplete or mixes incompatible actions.', group));
    }
    group.forEach((entry) => linkedEntries.add(entry.id));
  }

  for (const entry of entries) {
    if (linkedEntries.has(entry.id)) continue;
    const action = entry.action;
    const ballInHand = held(state, entry.performerId, entry.hand);

    switch (action.type) {
      case 'HOLD':
        if (!ballInHand) issues.push(problem('hold-without-ball', 'HOLD requires an object in the hand.', [entry]));
        break;
      case 'EMPTY':
        break;
      case 'SPECIAL':
        if (ballInHand) issues.push(problem('special-hand-occupied', 'SPECIAL requires free fingers.', [entry]));
        break;
      case 'LIFT': {
        if (action.target.kind === 'pass-source') {
          issues.push(problem('unpaired-individual-pass', 'Individual passing LIFT needs a matching LEAVE.', [entry]));
          break;
        }
        const positionId = resolvePosition(sequence, entry.performerId, action.target);
        if (!positionId) issues.push(problem('unknown-lift-target', 'LIFT target is not a valid table position.', [entry]));
        else if (ballInHand) issues.push(problem('lift-hand-occupied', 'LIFT requires free fingers.', [entry], [positionId]));
        else {
          const ballId = findBall(state, { kind: 'position', positionId });
          if (!ballId) issues.push(problem('lift-from-empty-position', 'LIFT target is empty.', [entry], [positionId]));
          else if (accessedPositions.has(positionId)) issues.push(problem('conflicting-position-actions', 'A position cannot be used by multiple actions in one beat.', [entry], [positionId]));
          else {
            accessedPositions.add(positionId);
            transfer(ballId, { kind: 'hand-held', performerId: entry.performerId, hand: entry.hand }, [entry]);
          }
        }
        break;
      }
      case 'LEAVE': {
        if (action.target.kind === 'pass-recipient-hand') {
          issues.push(problem('unpaired-individual-pass', 'Individual passing LEAVE needs a matching LIFT.', [entry]));
          break;
        }
        const positionId = resolvePosition(sequence, entry.performerId, action.target);
        if (!positionId) issues.push(problem('unknown-leave-target', 'LEAVE target is not a valid table position.', [entry]));
        else if (!ballInHand) issues.push(problem('leave-without-ball', 'LEAVE requires an object held in the hand.', [entry], [positionId]));
        else if (findBall(state, { kind: 'position', positionId })) issues.push(problem('leave-to-occupied-position', 'LEAVE target is occupied.', [entry], [positionId]));
        else if (accessedPositions.has(positionId)) issues.push(problem('conflicting-position-actions', 'A position cannot be used by multiple actions in one beat.', [entry], [positionId]));
        else {
          accessedPositions.add(positionId);
          transfer(ballInHand, { kind: 'position', positionId }, [entry]);
        }
        break;
      }
      case 'TAP':
        if (ballInHand) issues.push(problem('tap-with-held-ball', 'TAP requires free fingers. Use BOUNCE while holding an object.', [entry]));
        else if (!resolvePosition(sequence, entry.performerId, action.target)) issues.push(problem('unknown-tap-target', 'TAP target is not a valid table position.', [entry]));
        break;
      case 'BOUNCE':
        if (!ballInHand) issues.push(problem('bounce-without-ball', 'BOUNCE requires an object held in the hand.', [entry]));
        else if (!resolvePosition(sequence, entry.performerId, action.target)) issues.push(problem('unknown-bounce-target', 'BOUNCE target is not a valid table position.', [entry]));
        break;
      case 'ZIP':
        issues.push(problem('unpaired-zip', 'ZIP must have matching source and receiver symbols.', [entry]));
        break;
    }
  }

  if (issues.length) return issues;
  for (const [ballId, destination] of transfers) state.set(ballId, destination);
  return issues;
}

export function simulateSequence(sequence: Sequence): SimulationResult {
  const initial = initialState(sequence);
  const issues = [...initial.issues];
  const state = initial.state;
  const snapshots: ObjectStateSnapshot[] = [];

  if (!sequence.beats.length) {
    issues.push(problem('sequence-has-no-beats', 'A sequence must contain at least one beat.'));
    return { snapshots, validation: { isValid: false, issues } };
  }

  const firstBeat = sequence.beats[0];
  if (!firstBeat) return { snapshots, validation: { isValid: false, issues } };
  if (initial.issues.length) {
    snapshots.push(makeSnapshot(sequence, state, { beatId: firstBeat.id, offset: rational(0) }, 'before'));
    return { snapshots, validation: { isValid: false, issues } };
  }

  const beatIds = new Set(sequence.beats.map((beat) => beat.id));
  const entriesByBeat = new Map<string, NotationEntry[]>();
  const allEntryIds = new Set<ActionEntryId>();
  for (const entry of sequence.notation) {
    if (allEntryIds.has(entry.id)) issues.push(problem('duplicate-entry-id', 'Notation entry ID "' + entry.id + '" is duplicated.', [entry]));
    allEntryIds.add(entry.id);
    if (!beatIds.has(entry.time.beatId)) {
      issues.push(problem('unknown-action-beat', 'Action references unknown beat "' + entry.time.beatId + '".', [entry]));
      continue;
    }
    const group = entriesByBeat.get(entry.time.beatId) ?? [];
    group.push(entry);
    entriesByBeat.set(entry.time.beatId, group);
  }

  for (const beat of sequence.beats) {
    const at = { beatId: beat.id, offset: rational(0) };
    snapshots.push(makeSnapshot(sequence, state, at, 'before'));
    issues.push(...evaluateBeat(sequence, entriesByBeat.get(beat.id) ?? [], state));
    snapshots.push(makeSnapshot(sequence, state, at, 'after'));
  }

  return { snapshots, validation: { isValid: issues.length === 0, issues } };
}

export function validateSequence(sequence: Sequence) {
  return simulateSequence(sequence).validation;
}
