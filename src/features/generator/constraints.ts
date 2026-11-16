import type {
  GeneratorConstraints,
  NotationAction,
  NotationEntry,
  Sequence,
  SequenceFragment,
} from '../../domain/model';
import type { SimulationResult } from '../../domain/model';

function performerIndex(sequence: Sequence, id: string): number {
  return sequence.performers.findIndex((performer) => performer.id === id);
}

function positionIndex(sequence: Sequence, id: string): number {
  return sequence.positions.findIndex((position) => position.id === id);
}

function actionShape(sequence: Sequence, action: NotationAction, linkIndexes: ReadonlyMap<string, number>): unknown {
  const link = 'linkId' in action && action.linkId ? linkIndexes.get(action.linkId) : undefined;
  switch (action.type) {
    case 'HOLD':
    case 'EMPTY':
      return [action.type];
    case 'LIFT':
    case 'LEAVE': {
      const target = action.target;
      const targetShape = target.kind === 'position'
        ? ['position', positionIndex(sequence, target.positionId)]
        : target.kind === 'circle-position'
          ? ['circle-position', target.position, target.direction ?? null, target.distance ?? null]
          : target.kind === 'pass-source'
            ? ['pass-source', performerIndex(sequence, target.performerId)]
            : ['pass-recipient-hand', performerIndex(sequence, target.performerId), target.hand];
      return [action.type, targetShape, link ?? null];
    }
    case 'BOUNCE':
    case 'TAP': {
      const target = action.target.kind === 'position'
        ? ['position', positionIndex(sequence, action.target.positionId)]
        : ['circle-position', action.target.position, action.target.direction ?? null, action.target.distance ?? null];
      return [action.type, target];
    }
    case 'ZIP':
      return [action.type, action.role, link ?? null];
    case 'SPECIAL':
      return [action.type, action.text, link ?? null];
  }
}

function linkIndexes(sequence: Sequence): ReadonlyMap<string, number> {
  const result = new Map<string, number>();
  for (const entry of sequence.notation) {
    if ('linkId' in entry.action && entry.action.linkId && !result.has(entry.action.linkId)) {
      result.set(entry.action.linkId, result.size);
    }
  }
  return result;
}

function entryShape(sequence: Sequence, entry: NotationEntry, links: ReadonlyMap<string, number>): string {
  return JSON.stringify([
    performerIndex(sequence, entry.performerId),
    entry.hand,
    actionShape(sequence, entry.action, links),
  ]);
}

/** Structural contiguous fragment matching. Extra actions in the candidate beat are allowed. */
export function matchesFragment(sequence: Sequence, fragment: SequenceFragment): boolean {
  if (sequence.sequenceType !== fragment.sequenceType ||
    JSON.stringify(sequence.timeSignature) !== JSON.stringify(fragment.timeSignature) ||
    fragment.beats.length === 0 ||
    fragment.beats.length > sequence.beats.length) return false;

  const fragmentSequence = {
    ...sequence,
    performers: fragment.performers,
    positions: fragment.positions,
    beats: fragment.beats,
    notation: fragment.notation,
  };
  const fragmentByBeat = fragment.beats.map((beat) => {
    const entries = fragment.notation.filter((entry) => entry.time.beatId === beat.id);
    const links = linkIndexes({ ...fragmentSequence, notation: entries });
    return entries.map((entry) => entryShape(fragmentSequence, entry, links));
  });

  for (let start = 0; start <= sequence.beats.length - fragment.beats.length; start += 1) {
    const durationMatches = fragment.beats.every((beat, offset) =>
      (sequence.beats[start + offset]?.durationKind ?? 'regular') === (beat.durationKind ?? 'regular'));
    if (!durationMatches) continue;

    const allEntriesMatch = fragmentByBeat.every((expected, offset) => {
      if (expected.length === 0) return true;
      const candidateBeat = sequence.beats[start + offset];
      if (!candidateBeat) return false;
      const actualEntries = sequence.notation.filter((entry) => entry.time.beatId === candidateBeat.id);
      const actualLinks = linkIndexes({ ...sequence, notation: actualEntries });
      const actual = actualEntries.map((entry) => entryShape(sequence, entry, actualLinks));
      const remaining = [...actual];
      return expected.every((signature) => {
        const index = remaining.indexOf(signature);
        if (index < 0) return false;
        remaining.splice(index, 1);
        return true;
      });
    });
    if (allEntriesMatch) return true;
  }
  return false;
}

/** A completion candidate may add entries, but cannot change any part of its base sequence. */
export function preservesBaseSequence(base: Sequence, candidate: Sequence): boolean {
  const immutableFields: (keyof Sequence)[] = [
    'id', 'sequenceType', 'timeSignature', 'bpm', 'beats', 'performers',
    'positions', 'balls', 'initialState', 'individualPassingLayout',
    'tableLayout', 'seatAssignments',
  ];
  if (immutableFields.some((field) => JSON.stringify(base[field]) !== JSON.stringify(candidate[field]))) return false;

  const candidateEntries = new Map(candidate.notation.map((entry) => [entry.id, entry]));
  return base.notation.every((entry) => JSON.stringify(candidateEntries.get(entry.id)) === JSON.stringify(entry));
}

/** Every performer must have at least one non-EMPTY hand action in every beat. */
export function allBeatsUsed(sequence: Sequence): boolean {
  return sequence.performers.every((performer) =>
    sequence.beats.every((beat) =>
      sequence.notation.some((entry) =>
        entry.performerId === performer.id &&
        entry.time.beatId === beat.id &&
        entry.action.type !== 'EMPTY',
      ),
    ),
  );
}

export function satisfiesActionRequirements(sequence: Sequence, constraints: GeneratorConstraints): boolean {
  for (const requirement of constraints.actionRequirements) {
    const matchingEntries = sequence.notation.filter((entry) =>
      entry.action.type === requirement.actionType &&
      (requirement.performerId === undefined || entry.performerId === requirement.performerId),
    );
    // ZIP is a paired transfer. Count its shared link once, not its source and
    // receiver symbols separately, so "exactly two ZIPs" means two transfers.
    const count = requirement.actionType === 'ZIP'
      ? new Set(matchingEntries.flatMap((entry) =>
          entry.action.type === 'ZIP' ? [entry.action.linkId] : [],
        )).size
      : matchingEntries.length;
    if (requirement.occurrence === 'forbidden' && count !== 0) return false;
    if (requirement.occurrence === 'at-least-once' && count < 1) return false;
    if (requirement.occurrence === 'exact-count' && count !== requirement.count) return false;
  }

  if (constraints.requiredActionPerPerformer &&
    sequence.performers.some((performer) => !sequence.notation.some((entry) =>
      entry.performerId === performer.id && entry.action.type === constraints.requiredActionPerPerformer))) return false;

  const zipLinks = new Set(sequence.notation.flatMap((entry) =>
    entry.action.type === 'ZIP' ? [entry.action.linkId] : [],
  ));
  if (constraints.zipTransferCount !== undefined && zipLinks.size !== constraints.zipTransferCount) return false;

  const passLinks = new Set(sequence.notation.flatMap((entry) =>
    (entry.action.type === 'LEAVE' && entry.action.target.kind === 'pass-recipient-hand') ||
    (entry.action.type === 'LIFT' && entry.action.target.kind === 'pass-source')
      ? ('linkId' in entry.action && entry.action.linkId ? [entry.action.linkId] : [])
      : [],
  ));
  if (constraints.passCount !== undefined && passLinks.size !== constraints.passCount) return false;

  if (constraints.requiredFragments.some((fragment) => !matchesFragment(sequence, fragment))) return false;
  if (constraints.forbiddenFragments.some((fragment) => matchesFragment(sequence, fragment))) return false;
  return true;
}

function locationKey(location: Sequence['initialState']['placements'][number]['location']): string {
  if (location.kind === 'position') return 'p:' + location.positionId;
  if (location.kind === 'hand-held') return 'h:' + location.performerId + ':' + location.hand;
  return 'b:' + location.positionId + ':' + location.performerId + ':' + location.hand;
}

export function isLoopClosed(sequence: Sequence, simulation: SimulationResult): boolean {
  const finalBeat = sequence.beats[sequence.beats.length - 1];
  if (!finalBeat || !simulation.validation.isValid) return false;
  const final = simulation.snapshots.find((snapshot) =>
    snapshot.at.beatId === finalBeat.id && snapshot.phase === 'after');
  if (!final) return false;
  return sequence.balls.every((ball) => {
    const initialLocation = sequence.initialState.placements.find((placement) => placement.ballId === ball.id)?.location;
    const finalLocation = final.ballLocations[ball.id];
    return initialLocation !== undefined && finalLocation !== undefined &&
      locationKey(initialLocation) === locationKey(finalLocation);
  });
}
