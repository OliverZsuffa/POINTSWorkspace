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
): Choice[] {
  const choices: Choice[] = [];
  const targetFor = (position: Extract<Sequence['positions'][number], { kind: 'table' }>) => sequence.sequenceType === 'circle-passing'
    ? { kind: 'circle-position' as const, position: position.name as 'A' | 'B' | 'C' }
    : { kind: 'position' as const, positionId: position.id };

  const singles: NotationAction[] = [
    { type: 'HOLD' },
    ...sequence.positions.flatMap((position) => {
      const target = position.kind === 'table' ? targetFor(position) : { kind: 'position' as const, positionId: position.id };
      return [
        { type: 'LIFT' as const, target },
        { type: 'LEAVE' as const, target },
        ...(position.kind === 'table' ? [
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
      const clapLinkId = asLinkId('gen-clap-' + cell.beatIndex + '-' + cell.performerIndex);
      choices.push({
        entries: [
          makeEntry(cell, { type: 'SPECIAL', text: 'Clap', linkId: clapLinkId }, 'clap-left'),
          makeEntry(partner, { type: 'SPECIAL', text: 'Clap', linkId: clapLinkId }, 'clap-right'),
        ],
        coveredCells: [cellKey(cell), cellKey(partner)],
      });
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
        if (signal?.aborted || visited >= maxSearchNodes || yielded >= maxResults) return;
        visited += 1;
        if (visited % 256 === 0) await new Promise<void>((resolve) => setTimeout(resolve, 0));

        while (index < cells.length && occupied.has(cellKey(cells[index]!))) index += 1;
        if (index >= cells.length) {
          if (entries.length === 0) return;
          const candidate = { ...template, notation: [...template.notation, ...entries] };
          if (allBeatsUsed(candidate) && isAccepted(request, candidate, base)) yield candidate;
          return;
        }

        const cell = cells[index]!;
        const key = cellKey(cell);
        const exactZipTarget = request.constraints.zipTransferCount ??
          request.constraints.actionRequirements.find((requirement) =>
            requirement.actionType === 'ZIP' && requirement.occurrence === 'exact-count',
          )?.count;
        if (exactZipTarget !== undefined) {
          const currentZipLinks = new Set([
            ...template.notation,
            ...entries,
          ].flatMap((entry) => entry.action.type === 'ZIP' ? [entry.action.linkId] : []));
          const remainingZipPairs = template.beats.reduce((total, beat) =>
            total + template.performers.filter((performer) => {
              const leftKey = String(performer.id) + ':left:' + String(beat.id);
              const rightKey = String(performer.id) + ':right:' + String(beat.id);
              return !occupied.has(leftKey) && !occupied.has(rightKey);
            }).length, 0);
          if (currentZipLinks.size > exactZipTarget ||
            currentZipLinks.size + remainingZipPairs < exactZipTarget) return;
        }

        occupied.add(key);
        yield* visit(index + 1, entries);
        occupied.delete(key);

        const choices = buildChoices(template, cell, cells, occupied);
        if (exactZipTarget !== undefined && exactZipTarget > 0) {
          choices.sort((left, right) =>
            Number(right.entries.some((entry) => entry.action.type === 'ZIP')) -
            Number(left.entries.some((entry) => entry.action.type === 'ZIP')),
          );
        }
        for (const choice of choices) {
          if (signal?.aborted || visited >= maxSearchNodes || yielded >= maxResults) return;
          const newlyCovered = choice.coveredCells.filter((covered) => !occupied.has(covered));
          if (newlyCovered.length !== choice.coveredCells.length) continue;
          newlyCovered.forEach((covered) => occupied.add(covered));
          yield* visit(index + 1, [...entries, ...choice.entries]);
          newlyCovered.forEach((covered) => occupied.delete(covered));
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
};
