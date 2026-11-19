import {
  asActionEntryId,
  asLinkId,
} from '../../domain/ids';
import type {
  GeneratedCandidate,
  GeneratorRequest,
  NotationAction,
  NotationEntry,
  Sequence,
} from '../../domain/model';
import { rational } from '../../domain/time/rational';
import { simulateSequence } from '../../domain/state';
import {
  allBeatsUsed,
  isLoopClosed,
  preservesBaseSequence,
  satisfiesActionRequirements,
} from './constraints';

interface Cell {
  readonly performerId: Sequence['performers'][number]['id'];
  readonly hand: 'left' | 'right';
  readonly beatId: Sequence['beats'][number]['id'];
  readonly beatIndex: number;
  readonly performerIndex: number;
}

interface Choice {
  readonly entries: readonly NotationEntry[];
  readonly coveredCells: readonly string[];
}

const cellKey = (cell: Pick<Cell, 'performerId' | 'hand' | 'beatId'>) =>
  String(cell.performerId) + ':' + cell.hand + ':' + String(cell.beatId);

function makeEntry(cell: Cell, action: NotationAction, suffix: string): NotationEntry {
  return {
    id: asActionEntryId('gen-' + cell.beatIndex + '-' + cell.performerIndex + '-' + cell.hand + '-' + suffix),
    performerId: cell.performerId,
    hand: cell.hand,
    time: { beatId: cell.beatId, offset: rational(0) },
    action,
  };
}

function buildCells(sequence: Sequence): Cell[] {
  return sequence.beats.flatMap((beat, beatIndex) =>
    sequence.performers.flatMap((performer, performerIndex) =>
      (['left', 'right'] as const).map((hand) => ({
        performerId: performer.id,
        hand,
        beatId: beat.id,
        beatIndex,
        performerIndex,
      })),
    ),
  );
}

function buildChoices(
  sequence: Sequence,
  cell: Cell,
  cells: readonly Cell[],
  occupied: ReadonlySet<string>,
  abstractLocations = false,
  allowClap = !abstractLocations,
  allowTapBounce = !abstractLocations,
): Choice[] {
  const choices: Choice[] = [];
  const targetFor = (position: Extract<Sequence['positions'][number], { kind: 'table' }>) => sequence.sequenceType === 'circle-passing'
    ? { kind: 'circle-position' as const, position: position.name as 'A' | 'B' | 'C' }
    : { kind: 'position' as const, positionId: position.id };

  const abstractPosition = sequence.positions.find((position) => position.kind === 'table') ?? sequence.positions[0];
  const targetPositions = abstractLocations
    ? abstractPosition ? [abstractPosition] : []
    : sequence.positions;
  const singles: NotationAction[] = [
    { type: 'HOLD' },
    ...targetPositions.flatMap((position) => {
      const target = position.kind === 'table' ? targetFor(position) : { kind: 'position' as const, positionId: position.id };
      return [
        { type: 'LIFT' as const, target },
        { type: 'LEAVE' as const, target },
        ...(position.kind === 'table' && allowTapBounce ? [
          { type: 'TAP' as const, target },
          { type: 'BOUNCE' as const, target },
        ] : []),
      ];
    }),
    { type: 'EMPTY' },
  ];

  singles.forEach((action, index) => {
    choices.push({
      entries: [makeEntry(cell, action, 'a' + index)],
      coveredCells: [cellKey(cell)],
    });
  });

  const partnerCells = cells.filter((partner) =>
    partner.beatId === cell.beatId &&
    cellKey(partner) !== cellKey(cell) &&
    !occupied.has(cellKey(partner)) &&
    cells.indexOf(partner) > cells.indexOf(cell),
  );

  for (const partner of partnerCells) {
    if (partner.performerId === cell.performerId && partner.hand !== cell.hand) {
      if (allowClap) {
        const clapLinkId = asLinkId('gen-clap-' + cell.beatIndex + '-' + cell.performerIndex);
      choices.push({
        entries: [
          makeEntry(cell, { type: 'SPECIAL', text: 'Clap', linkId: clapLinkId }, 'clap-left'),
          makeEntry(partner, { type: 'SPECIAL', text: 'Clap', linkId: clapLinkId }, 'clap-right'),
        ],
        coveredCells: [cellKey(cell), cellKey(partner)],
      });
      }
      for (const [source, receiver] of [[cell, partner], [partner, cell]] as const) {
        const linkId = asLinkId('gen-zip-' + cell.beatIndex + '-' + cell.performerIndex + '-' + source.hand);
        choices.push({
          entries: [
            makeEntry(source, { type: 'ZIP', role: 'source', linkId }, 'zip-source'),
            makeEntry(receiver, { type: 'ZIP', role: 'receiver', linkId }, 'zip-receiver'),
          ],
          coveredCells: [cellKey(cell), cellKey(partner)],
        });
      }
    }

    if (sequence.sequenceType === 'individual-passing' && partner.performerId !== cell.performerId) {
      for (const [sender, receiver] of [[cell, partner], [partner, cell]] as const) {
        const linkId = asLinkId('gen-pass-' + cell.beatIndex + '-' + sender.performerIndex + '-' + receiver.performerIndex + '-' + sender.hand + '-' + receiver.hand);
        choices.push({
          entries: [
            makeEntry(sender, {
              type: 'LEAVE',
              target: { kind: 'pass-recipient-hand', performerId: receiver.performerId, hand: receiver.hand },
              linkId,
            }, 'pass-send'),
            makeEntry(receiver, {
              type: 'LIFT',
              target: { kind: 'pass-source', performerId: sender.performerId },
              linkId,
            }, 'pass-receive'),
          ],
          coveredCells: [cellKey(cell), cellKey(partner)],
        });
      }
    }
  }

  return choices;
}

function sameInitialState(left: Sequence, right: Sequence): boolean {
  return JSON.stringify(left.initialState) === JSON.stringify(right.initialState);
}

function prepareTemplates(request: GeneratorRequest): Sequence[] {
  const base = request.mode === 'complete-base' ? request.baseSequence : request.templateSequence;
  if (!base) return [];
  if (base.beats.length !== request.beatCount ||
    base.performers.length !== request.performerCount ||
    base.balls.length !== request.objectCount) return [];

  if (request.mode === 'complete-base') {
    if (JSON.stringify(base.timeSignature) !== JSON.stringify(request.timeSignature) ||
      !sameInitialState(base, { ...base, initialState: request.initialState }) ||
      JSON.stringify(base.positions) !== JSON.stringify(request.availablePositions) ||
      !request.sequenceTypes.includes(base.sequenceType)) return [];
    return [base];
  }

  if (JSON.stringify(base.positions) !== JSON.stringify(request.availablePositions)) return [];
  return request.sequenceTypes.map((sequenceType) => ({
    ...base,
    sequenceType,
    timeSignature: request.timeSignature,
    initialState: request.initialState,
    notation: [],
  }));
}

function isAccepted(
  request: GeneratorRequest,
  sequence: Sequence,
  base: Sequence | undefined,
): boolean {
  if (base && !preservesBaseSequence(base, sequence)) return false;
  const simulation = simulateSequence(sequence);
  if (!simulation.validation.isValid) return false;
  if (!satisfiesActionRequirements(sequence, request.constraints)) return false;
  const closed = isLoopClosed(sequence, simulation);
  if (request.constraints.looping === 'must-loop' && !closed) return false;
  if (request.constraints.looping === 'must-not-loop' && closed) return false;
  return true;
}

/**
 * Validates hand state without binding abstract location actions to one
 * placeholder position. Concrete position occupancy and collisions remain
 * the responsibility of the full simulator during location expansion.
 */
export function isAbstractStateValid(sequence: Sequence): boolean {
  const held = new Map<string, boolean>();
  for (const performer of sequence.performers) {
    held.set(String(performer.id) + ':left', false);
    held.set(String(performer.id) + ':right', false);
  }
  let tableObjects = 0;
  let backObjects = 0;
  const positionById = new Map(sequence.positions.map((position) => [String(position.id), position]));
  for (const placement of sequence.initialState.placements) {
    if (placement.location.kind === 'hand-held') return false;
    if (placement.location.kind === 'position') {
      tableObjects += 1;
    } else if (placement.location.kind === 'hand-back') {
      backObjects += 1;
    }
  }
  const handKey = (entry: NotationEntry) => String(entry.performerId) + ':' + entry.hand;
  const beats = sequence.beats;
  for (const beat of beats) {
    const entries = sequence.notation.filter((entry) => entry.time.beatId === beat.id);
    const links = new Map<string, NotationEntry[]>();
    for (const entry of entries) {
      if ('linkId' in entry.action && entry.action.linkId) {
        const group = links.get(entry.action.linkId) ?? [];
        group.push(entry);
        links.set(entry.action.linkId, group);
      }
    }
    const linked = new Set<string>();
    const nextHeld = new Map(held);
    let tableDelta = 0;
    let backDelta = 0;
    let tableLifts = 0;
    let backLifts = 0;
    for (const [linkId, group] of links) {
      const zips = group.filter((entry) => entry.action.type === 'ZIP');
      const passes = group.filter((entry) =>
        (entry.action.type === 'LEAVE' && entry.action.target.kind === 'pass-recipient-hand') ||
        (entry.action.type === 'LIFT' && entry.action.target.kind === 'pass-source'));
      const specials = group.filter((entry) => entry.action.type === 'SPECIAL');
      if (zips.length === 2 && zips.length === group.length) {
        const source = zips.find((entry) => entry.action.type === 'ZIP' && entry.action.role === 'source');
        const receiver = zips.find((entry) => entry.action.type === 'ZIP' && entry.action.role === 'receiver');
        if (!source || !receiver || source.performerId !== receiver.performerId ||
          source.hand === receiver.hand || !held.get(handKey(source)) || held.get(handKey(receiver))) return false;
        nextHeld.set(handKey(source), false);
        nextHeld.set(handKey(receiver), true);
      } else if (passes.length === 2 && passes.length === group.length) {
        const sender = passes.find((entry) => entry.action.type === 'LEAVE' && entry.action.target.kind === 'pass-recipient-hand');
        const receiver = passes.find((entry) => entry.action.type === 'LIFT' && entry.action.target.kind === 'pass-source');
        const senderTarget = sender?.action.type === 'LEAVE' ? sender.action.target : undefined;
        const receiverTarget = receiver?.action.type === 'LIFT' ? receiver.action.target : undefined;
        if (!sender || !receiver || sender.performerId === receiver.performerId ||
          senderTarget?.kind !== 'pass-recipient-hand' || receiverTarget?.kind !== 'pass-source' ||
          senderTarget.performerId !== receiver.performerId || senderTarget.hand !== receiver.hand ||
          receiverTarget.performerId !== sender.performerId ||
          !held.get(handKey(sender)) || held.get(handKey(receiver))) return false;
        nextHeld.set(handKey(sender), false);
        nextHeld.set(handKey(receiver), true);
      } else if (specials.length === 2 && specials.length === group.length) {
        const [first, second] = specials;
        if (!first || !second || first.performerId !== second.performerId || first.hand === second.hand ||
          first.action.type !== 'SPECIAL' || second.action.type !== 'SPECIAL' ||
          first.action.text !== second.action.text || held.get(handKey(first)) || held.get(handKey(second))) return false;
      } else {
        return false;
      }
      group.forEach((entry) => linked.add(String(entry.id)));
      void linkId;
    }
    for (const entry of entries) {
      if (linked.has(String(entry.id))) continue;
      const isHeld = Boolean(held.get(handKey(entry)));
      switch (entry.action.type) {
        case 'HOLD':
        case 'BOUNCE':
          if (!isHeld) return false;
          break;
        case 'EMPTY':
        case 'TAP':
        case 'SPECIAL':
          if (isHeld) return false;
          break;
        case 'LIFT': {
          if (entry.action.target.kind === 'pass-source' || isHeld) return false;
          const target = entry.action.target.kind === 'position' ? positionById.get(String(entry.action.target.positionId)) : undefined;
          if (target?.kind === 'hand-back') {
            if (backObjects - backLifts <= 0) return false;
            backLifts += 1;
            backDelta -= 1;
          } else {
            if (tableObjects - tableLifts <= 0) return false;
            tableLifts += 1;
            tableDelta -= 1;
          }
          nextHeld.set(handKey(entry), true);
          break;
        }
        case 'LEAVE': {
          if (entry.action.target.kind === 'pass-recipient-hand' || !isHeld) return false;
          const target = entry.action.target.kind === 'position' ? positionById.get(String(entry.action.target.positionId)) : undefined;
          if (target?.kind === 'hand-back') backDelta += 1;
          else tableDelta += 1;
          nextHeld.set(handKey(entry), false);
          break;
        }
        case 'ZIP':
          return false;
      }
    }
    held.clear();
    nextHeld.forEach((value, key) => held.set(key, value));
    tableObjects += tableDelta;
    backObjects += backDelta;
  }
  return true;
}

function isAbstractHandlingChainsValid(sequence: Sequence): boolean {
  const beatIndex = new Map(sequence.beats.map((beat, index) => [beat.id, index]));
  const entries = [...sequence.notation].sort((a, b) =>
    (beatIndex.get(a.time.beatId) ?? 0) - (beatIndex.get(b.time.beatId) ?? 0) ||
    String(a.performerId).localeCompare(String(b.performerId)) || a.hand.localeCompare(b.hand));
  const active = new Set<string>(), previous = new Map<string, NotationEntry>();
  const key = (entry: NotationEntry) => String(entry.performerId) + ':' + entry.hand;
  const validPredecessors = ['LIFT', 'HOLD', 'ZIP', 'BOUNCE'];
  const zipReceivers = new Map<string, NotationEntry>();
  for (const entry of entries) if (entry.action.type === 'ZIP' && entry.action.role === 'receiver') zipReceivers.set(entry.action.linkId, entry);
  for (const entry of entries) {
    const hand = key(entry), prior = previous.get(hand), action = entry.action;
    if (action.type === 'ZIP' && action.role === 'receiver') { previous.set(hand, entry); continue; }
    if (action.type === 'LIFT' && action.target.kind === 'pass-source') { previous.set(hand, entry); continue; }
    if (action.type === 'LEAVE' && action.target.kind === 'pass-recipient-hand') { active.delete(hand); previous.set(hand, entry); continue; }
    if (action.type === 'LIFT') active.add(hand);
    else if (action.type === 'HOLD' || action.type === 'BOUNCE') {
      if ((!active.has(hand)) || (!prior) || (prior && !validPredecessors.includes(prior.action.type))) return false;
      active.add(hand);
    } else if (action.type === 'ZIP') {
      if (action.role === 'source') {
        if ((!active.has(hand)) || (prior && !validPredecessors.includes(prior.action.type)) || (!prior)) return false;
        const receiver = zipReceivers.get(action.linkId);
        if (receiver && active.has(hand)) active.add(key(receiver));
        active.delete(hand);
      }
    } else if (action.type === 'LEAVE') {
      if (!active.has(hand) || !prior || !validPredecessors.includes(prior.action.type)) return false;
      active.delete(hand);
    } else if (active.has(hand) && ['EMPTY', 'TAP', 'SPECIAL'].includes(action.type)) return false;
    previous.set(hand, entry);
  }
  return active.size === 0;
}

function isStructurallyAccepted(
  request: GeneratorRequest,
  sequence: Sequence,
  base: Sequence | undefined,
): boolean {
  if (base && !preservesBaseSequence(base, sequence)) return false;
  if (!isAbstractStateValid(sequence) || !isAbstractHandlingChainsValid(sequence)) return false;
  return satisfiesActionRequirements(sequence, {
    ...request.constraints,
    looping: 'either',
    requiredFragments: [],
    forbiddenFragments: [],
  });
}

function isLocationAction(action: NotationAction): action is Extract<NotationAction, { type: 'LIFT' | 'LEAVE' | 'TAP' | 'BOUNCE' }> {
  return (action.type === 'LIFT' || action.type === 'LEAVE' || action.type === 'TAP' || action.type === 'BOUNCE') &&
    (action.target.kind === 'position' || action.target.kind === 'circle-position');
}

type LocationTarget = Extract<Extract<NotationAction, { type: 'LIFT' }>['target'], { kind: 'position' | 'circle-position' }>;

function locationTarget(sequence: Sequence, position: Sequence['positions'][number]): LocationTarget {
  if (sequence.sequenceType === 'circle-passing' && position.kind === 'table') {
    return { kind: 'circle-position', position: position.name as 'A' | 'B' | 'C' };
  }
  return { kind: 'position', positionId: position.id };
}

/** Builds simulator-validated optional flourish combinations from a core sequence. */
export function generateFlourishes(sequence: Sequence): Sequence[] {
  const tablePosition = sequence.positions.find((position) => position.kind === 'table');
  if (!tablePosition) return [sequence];
  const target = sequence.sequenceType === 'circle-passing'
    ? { kind: 'circle-position' as const, position: tablePosition.name as 'A' | 'B' | 'C' }
    : { kind: 'position' as const, positionId: tablePosition.id };
  const variants: Sequence[] = [sequence];
  const seen = new Set([candidateKey(sequence)]);
  const maxVariants = 64;

  const add = (source: Sequence, notation: NotationEntry[]) => {
    if (variants.length >= maxVariants) return;
    const candidate = { ...source, notation };
    if (!simulateSequence(candidate).validation.isValid) return;
    const key = candidateKey(candidate);
    if (seen.has(key)) return;
    seen.add(key);
    variants.push(candidate);
  };

  // Grow the set iteratively, so compatible flourishes can coexist rather
  // than only ever producing one isolated substitution per core sequence.
  for (let cursor = 0; cursor < variants.length && variants.length < maxVariants; cursor++) {
    const source = variants[cursor]!;
    source.notation.forEach((entry) => {
      if (entry.action.type === 'HOLD') {
        add(source, source.notation.map((item) => item.id === entry.id
          ? { ...item, action: { type: 'BOUNCE' as const, target } } : item));
      } else if (entry.action.type === 'EMPTY') {
        add(source, source.notation.map((item) => item.id === entry.id
          ? { ...item, action: { type: 'TAP' as const, target } } : item));
      }
    });
    for (const performer of source.performers) {
      for (const beat of source.beats) {
        const left = source.notation.find((entry) => entry.performerId === performer.id && entry.hand === 'left' && entry.time.beatId === beat.id && entry.action.type === 'EMPTY');
        const right = source.notation.find((entry) => entry.performerId === performer.id && entry.hand === 'right' && entry.time.beatId === beat.id && entry.action.type === 'EMPTY');
        if (!left || !right) continue;
        const linkId = asLinkId('flourish-clap-' + performer.id + '-' + beat.id);
        add(source, source.notation.map((entry) => entry.id === left.id || entry.id === right.id
          ? { ...entry, action: { type: 'SPECIAL' as const, text: 'Clap', linkId } }
          : entry));
      }
    }
  }
  return variants;
}

export function candidateKey(sequence: Sequence, canonicalizeRotation = false): string {
  const beatIndex = new Map(sequence.beats.map((beat, index) => [beat.id, index]));
  const performerIndex = new Map(sequence.performers.map((performer, index) => [performer.id, index]));
  const positionIndex = new Map(sequence.positions.map((position, index) => [position.id, index]));
  const rotations = canonicalizeRotation ? sequence.beats.map((_, index) => index) : [0];

  const serializeRotation = (rotation: number): string => {
    const count = sequence.beats.length;
    const rotatedEntries = sequence.notation.map((entry) => ({
      entry,
      beat: ((beatIndex.get(entry.time.beatId) ?? 0) - rotation + count) % count,
      performer: performerIndex.get(entry.performerId) ?? -1,
    })).sort((a, b) =>
      a.beat - b.beat ||
      a.performer - b.performer ||
      a.entry.hand.localeCompare(b.entry.hand),
    );

    const linkIds = [...new Set(rotatedEntries.flatMap(({ entry }) =>
      'linkId' in entry.action && entry.action.linkId ? [entry.action.linkId] : [],
    ))];
    const linkIndexes = new Map(linkIds.map((linkId, index) => [linkId, index]));
    const entries = rotatedEntries.map(({ entry, beat, performer }) => {
      const action = entry.action;
      const link = 'linkId' in action && action.linkId ? linkIndexes.get(action.linkId) : null;
      let actionShape: unknown;
      if (action.type === 'HOLD' || action.type === 'EMPTY') actionShape = [action.type];
      else if (action.type === 'ZIP') actionShape = [action.type, action.role, link];
      else if (action.type === 'SPECIAL') actionShape = [action.type, action.text, link];
      else if (action.target.kind === 'position') actionShape = [action.type, positionIndex.get(action.target.positionId), link];
      else if (action.target.kind === 'circle-position') actionShape = [action.type, action.target.position, action.target.direction, action.target.distance];
      else if (action.target.kind === 'pass-source') actionShape = [action.type, performerIndex.get(action.target.performerId), link];
      else actionShape = [action.type, performerIndex.get(action.target.performerId), action.target.hand, link];
      return [beat, performer, entry.hand, actionShape];
    });

    return JSON.stringify({
      sequenceType: sequence.sequenceType,
      timeSignature: sequence.timeSignature,
      beats: sequence.beats.map((_beat, index) => sequence.beats[(index + rotation) % count]?.durationKind ?? 'regular'),
      performers: sequence.performers,
      positions: sequence.positions,
      balls: sequence.balls.length,
      initialState: sequence.initialState,
      entries,
    });
  };

  return rotations.map(serializeRotation).sort()[0] ?? '';
}

/**
 * Deterministic depth first search. Existing base entries are never changed.
 * The shared simulator is the final authority for every returned candidate.
 */
export const sequenceGenerator = {
  async *generate(request: GeneratorRequest, signal?: AbortSignal): AsyncIterable<GeneratedCandidate> {
    const templates = prepareTemplates(request);
    if (!templates.length) return;

    const maxResults = Math.max(1, Math.floor(request.maxResults ?? 100));
    const maxSearchNodes = Math.max(1, Math.floor(request.maxSearchNodes ?? 100_000));
    let yielded = 0;
    let visited = 0;
    let searchLimitNotified = false;
    const seen = new Set<string>();

    for (const template of templates) {
      if (signal?.aborted || yielded >= maxResults) return;
      const base = request.mode === 'complete-base' ? request.baseSequence : undefined;
      if (base && !simulateSequence(base).validation.isValid) continue;

      const cells = buildCells(template);
      const existing = new Set(template.notation.map((entry) =>
        String(entry.performerId) + ':' + entry.hand + ':' + String(entry.time.beatId)));
      const occupied = new Set(existing);

      async function* visit(index: number, entries: readonly NotationEntry[]): AsyncGenerator<Sequence> {
        if (signal?.aborted || visited >= maxSearchNodes || yielded >= maxResults) {
          if (visited >= maxSearchNodes && !searchLimitNotified) {
            searchLimitNotified = true;
            request.onSearchLimitReached?.('structures');
          }
          return;
        }
        visited += 1;
        if (visited % 256 === 0) await new Promise<void>((resolve) => setTimeout(resolve, 0));

        while (index < cells.length && occupied.has(cellKey(cells[index]!))) index += 1;
        if (index >= cells.length) {
          if (entries.length === 0) return;
          const candidate = { ...template, notation: [...template.notation, ...entries] };
          if (allBeatsUsed(candidate) && (request.locationMode === 'abstract'
            ? isStructurallyAccepted(request, candidate, base)
            : isAccepted(request, candidate, base))) yield candidate;
          return;
        }

        const cell = cells[index]!;
        const key = cellKey(cell);
        const exactZipRequirement = request.constraints.actionRequirements.find((requirement) =>
          requirement.actionType === 'ZIP' && requirement.occurrence === 'exact-count',
        );
        const exactZipTarget = request.constraints.zipTransferCount ??
          (exactZipRequirement && 'count' in exactZipRequirement ? exactZipRequirement.count : undefined);
        const exactSpecialRequirement = request.constraints.actionRequirements.find((requirement) =>
          requirement.actionType === 'SPECIAL' && requirement.occurrence === 'exact-count',
        );
        const exactSpecialTarget = exactSpecialRequirement && 'count' in exactSpecialRequirement
          ? exactSpecialRequirement.count
          : undefined;
        const currentZipLinks = new Set([
          ...template.notation,
          ...entries,
        ].flatMap((entry) => entry.action.type === 'ZIP' ? [entry.action.linkId] : []));
        if (exactZipTarget !== undefined) {
          const remainingZipPairs = template.beats.reduce((total, beat) =>
            total + template.performers.filter((performer) => {
              const leftKey = String(performer.id) + ':left:' + String(beat.id);
              const rightKey = String(performer.id) + ':right:' + String(beat.id);
              return !occupied.has(leftKey) && !occupied.has(rightKey);
            }).length, 0);
          if (currentZipLinks.size > exactZipTarget ||
            currentZipLinks.size + remainingZipPairs < exactZipTarget) return;
        }

        const zipStillNeeded = exactZipTarget !== undefined &&
          currentZipLinks.size < exactZipTarget;
        const currentEntries = [...template.notation, ...entries];
        const currentSpecialCount = currentEntries.filter((entry) => entry.action.type === 'SPECIAL').length;
        const clapStillNeeded = exactSpecialTarget !== undefined && currentSpecialCount < exactSpecialTarget;
        const requiredActionTypes = new Set<string>();
        for (const requirement of request.constraints.actionRequirements) {
          const count = requirement.actionType === 'ZIP'
            ? new Set(currentEntries.flatMap((entry) => entry.action.type === 'ZIP' ? [entry.action.linkId] : [])).size
            : currentEntries.filter((entry) => entry.action.type === requirement.actionType).length;
          if (requirement.occurrence === 'at-least-once' && count === 0) requiredActionTypes.add(requirement.actionType);
          if (requirement.occurrence === 'exact-count' && count < requirement.count) requiredActionTypes.add(requirement.actionType);
        }
        if (request.constraints.requiredActionPerPerformer &&
          !currentEntries.some((entry) =>
            entry.performerId === cell.performerId &&
            entry.action.type === request.constraints.requiredActionPerPerformer,
          )) {
          requiredActionTypes.add(request.constraints.requiredActionPerPerformer);
        }
        const performerHasAction = currentEntries.some((entry) =>
          entry.performerId === cell.performerId && entry.time.beatId === cell.beatId && entry.action.type !== 'EMPTY');
        const hasLaterFreeHand = cells.slice(index + 1).some((later) =>
          later.performerId === cell.performerId && later.beatId === cell.beatId && !occupied.has(cellKey(later)));
        const mustUseThisPerformerBeat = !performerHasAction && !hasLaterFreeHand;
        if (!zipStillNeeded && !clapStillNeeded && !mustUseThisPerformerBeat) {
          occupied.add(key);
          yield* visit(index + 1, entries);
          occupied.delete(key);
        }

        const choices = buildChoices(template, cell, cells, occupied, request.locationMode === 'abstract', request.constraints.actionRequirements.some((requirement) => (requirement.actionType === 'SPECIAL' || requirement.actionType === 'TAP' || requirement.actionType === 'BOUNCE') && requirement.occurrence !== 'forbidden') || request.constraints.requiredActionPerPerformer === 'SPECIAL', request.constraints.actionRequirements.some((requirement) => (requirement.actionType === 'TAP' || requirement.actionType === 'BOUNCE') && requirement.occurrence !== 'forbidden'));
        const choicePriority = (choice: Choice): number => {
          let score = 0;
          if (zipStillNeeded && choice.entries.some((entry) => entry.action.type === 'ZIP')) score += 1000;
          if (clapStillNeeded && choice.entries.length === 2 && choice.entries.every((entry) =>
            entry.action.type === 'SPECIAL' && entry.action.text === 'Clap',
          )) score += 1000;
          for (const actionType of requiredActionTypes) {
            if (choice.entries.some((entry) => entry.action.type === actionType)) score += 100;
          }
          return score;
        };
        choices.sort((left, right) => choicePriority(right) - choicePriority(left));
        for (const choice of choices) {
          if (signal?.aborted || visited >= maxSearchNodes || yielded >= maxResults) {
        if (visited >= maxSearchNodes && !searchLimitNotified) {
          searchLimitNotified = true;
          request.onSearchLimitReached?.('structures');
        }
        return;
      }
          if (mustUseThisPerformerBeat && choice.entries.every((entry) => entry.action.type === 'EMPTY')) continue;
          if (exactZipTarget !== undefined &&
            currentZipLinks.size >= exactZipTarget &&
            choice.entries.some((entry) => entry.action.type === 'ZIP')) continue;
          if (exactSpecialTarget !== undefined &&
            currentSpecialCount >= exactSpecialTarget &&
            choice.entries.some((entry) => entry.action.type === 'SPECIAL')) continue;
          const newlyCovered = choice.coveredCells.filter((covered) => !occupied.has(covered));
          if (newlyCovered.length !== choice.coveredCells.length) continue;
          newlyCovered.forEach((covered) => occupied.add(covered));
          const nextEntries = [...entries, ...choice.entries];
          const partialSequence = { ...template, notation: [...template.notation, ...nextEntries] };
          if (request.locationMode !== 'abstract' || isAbstractStateValid(partialSequence)) {
            yield* visit(index + 1, nextEntries);
          }
          newlyCovered.forEach((covered) => occupied.delete(covered));
        }
        if (zipStillNeeded || mustUseThisPerformerBeat) {
          if (zipStillNeeded && !mustUseThisPerformerBeat) {
            occupied.add(key);
            yield* visit(index + 1, entries);
            occupied.delete(key);
          }
        }
      }

      for await (const candidate of visit(0, [])) {
        if (signal?.aborted) return;
        const key = candidateKey(candidate, request.constraints.looping === 'must-loop');
        if (seen.has(key)) continue;
        seen.add(key);
        yielded += 1;
        yield { sequence: candidate };
        if (yielded >= maxResults) return;
      }
    }
  },

  async *expandLocations(
    structure: Sequence,
    request: GeneratorRequest,
    signal?: AbortSignal,
  ): AsyncIterable<GeneratedCandidate> {
    const base = request.mode === 'complete-base' ? request.baseSequence : undefined;
    const immutableIds = new Set(base?.notation.map((entry) => entry.id) ?? []);
    const expandable = structure.notation.filter((entry) =>
      !immutableIds.has(entry.id) && isLocationAction(entry.action),
    );
    const targetOptions = expandable.map((entry) => {
      const positions = structure.positions.filter((position) =>
        (entry.action.type === 'TAP' || entry.action.type === 'BOUNCE') ? position.kind === 'table' : true,
      );
      return positions.map((position) => ({
        entryId: entry.id,
        target: locationTarget(structure, position),
      }));
    });
    const maxResults = Math.max(1, Math.floor(request.maxResults ?? 100));
    const maxSearchNodes = Math.max(1, Math.floor(request.maxSearchNodes ?? 100_000));
    let visited = 0;
    let searchLimitNotified = false;
    let yielded = 0;
    const seen = new Set<string>();
    const selected = new Map<string, LocationTarget>();

    async function* visit(index: number): AsyncGenerator<Sequence> {
      if (signal?.aborted || visited >= maxSearchNodes || yielded >= maxResults) {
        if (visited >= maxSearchNodes && !searchLimitNotified) {
          searchLimitNotified = true;
          request.onSearchLimitReached?.('locations');
        }
        return;
      }
      visited += 1;
      if (visited % 256 === 0) await new Promise<void>((resolve) => setTimeout(resolve, 0));
      if (index >= expandable.length) {
        const notation = structure.notation.map((entry) => {
          const target = selected.get(entry.id);
          if (!target || !isLocationAction(entry.action)) return entry;
          return { ...entry, action: { ...entry.action, target } } as NotationEntry;
        });
        const candidate = { ...structure, notation };
        if (allBeatsUsed(candidate) && isAccepted(request, candidate, base)) yield candidate;
        return;
      }
      const entry = expandable[index]!;
      const options = targetOptions[index] ?? [];
      for (const option of options) {
        selected.set(entry.id, option.target);
        yield* visit(index + 1);
        selected.delete(entry.id);
        if (signal?.aborted || visited >= maxSearchNodes || yielded >= maxResults) {
          if (visited >= maxSearchNodes && !searchLimitNotified) {
            searchLimitNotified = true;
            request.onSearchLimitReached?.('locations');
          }
          return;
        }
      }
    }

    for await (const candidate of visit(0)) {
      if (signal?.aborted) return;
      const key = candidateKey(candidate, request.constraints.looping === 'must-loop');
      if (seen.has(key)) continue;
      seen.add(key);
      yielded += 1;
      yield { sequence: candidate };
    }
  },
};
