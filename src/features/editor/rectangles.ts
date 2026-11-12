import type { NotationEntry, Sequence, SimulationResult } from '../../domain/model';

type SegmentSeed = { performerId: NotationEntry['performerId']; hand: NotationEntry['hand']; beatIndex: number };

function heldBall(simulation: SimulationResult, sequence: Sequence, beatIndex: number, phase: 'before' | 'after', performerId: NotationEntry['performerId'], hand: NotationEntry['hand']) {
  const beat = sequence.beats[beatIndex];
  if (!beat) return undefined;
  const snapshot = simulation.snapshots.find((item) => item.at.beatId === beat.id && item.phase === phase);
  return snapshot?.handStates[performerId]?.[hand].heldBallId ?? undefined;
}

function linkedCounterpart(sequence: Sequence, entry: NotationEntry): NotationEntry | undefined {
  if (!('linkId' in entry.action) || !entry.action.linkId) return undefined;
  const linkId = entry.action.linkId;
  if (entry.action.type === 'ZIP') {
    return sequence.notation.find((item) => item.id !== entry.id && item.action.type === 'ZIP' && item.action.linkId === linkId);
  }
  if (entry.action.type === 'LEAVE' && entry.action.target.kind === 'pass-recipient-hand') {
    return sequence.notation.find((item) => item.id !== entry.id && item.action.type === 'LIFT' && item.action.linkId === linkId);
  }
  if (entry.action.type === 'LIFT' && entry.action.target.kind === 'pass-source') {
    return sequence.notation.find((item) => item.id !== entry.id && item.action.type === 'LEAVE' && item.action.linkId === linkId);
  }
  if (entry.action.type === 'SPECIAL') {
    return sequence.notation.find((item) => item.id !== entry.id && item.action.type === 'SPECIAL' && item.action.linkId === linkId);
  }
  return undefined;
}

export function getBallRectangleEntries(
  sequence: Sequence,
  simulation: SimulationResult,
  selected: NotationEntry,
): readonly NotationEntry[] {
  if (!['LIFT', 'HOLD', 'BOUNCE', 'LEAVE', 'ZIP'].includes(selected.action.type)) {
    const counterpart = linkedCounterpart(sequence, selected);
    return counterpart ? [selected, counterpart] : [selected];
  }

  const selectedBeatIndex = sequence.beats.findIndex((beat) => beat.id === selected.time.beatId);
  if (selectedBeatIndex < 0) return [];
  const selectedPhase = selected.action.type === 'LIFT' || (selected.action.type === 'ZIP' && selected.action.role === 'receiver') ? 'after' : 'before';
  const ballId = heldBall(simulation, sequence, selectedBeatIndex, selectedPhase, selected.performerId, selected.hand);
  if (!ballId) return [];

  const result = new Map<string, NotationEntry>();
  const pending: SegmentSeed[] = [{ performerId: selected.performerId, hand: selected.hand, beatIndex: selectedBeatIndex }];
  const visited = new Set<string>();

  while (pending.length) {
    const seed = pending.pop()!;
    let start = seed.beatIndex;
    let end = seed.beatIndex;
    while (start > 0 && heldBall(simulation, sequence, start - 1, 'after', seed.performerId, seed.hand) === ballId) start -= 1;
    while (end < sequence.beats.length - 1 && heldBall(simulation, sequence, end, 'after', seed.performerId, seed.hand) === ballId) end += 1;
    const segmentKey = seed.performerId + ':' + seed.hand + ':' + start + ':' + end;
    if (visited.has(segmentKey)) continue;
    visited.add(segmentKey);

    for (const entry of sequence.notation) {
      if (entry.performerId !== seed.performerId || entry.hand !== seed.hand) continue;
      const index = sequence.beats.findIndex((beat) => beat.id === entry.time.beatId);
      if (index < start || index > end) continue;
      if (!['LIFT', 'HOLD', 'BOUNCE', 'LEAVE', 'ZIP'].includes(entry.action.type)) continue;
      const before = heldBall(simulation, sequence, index, 'before', seed.performerId, seed.hand);
      const after = heldBall(simulation, sequence, index, 'after', seed.performerId, seed.hand);
      if (before !== ballId && after !== ballId) continue;
      result.set(entry.id, entry);
      const counterpart = linkedCounterpart(sequence, entry);
      if (counterpart) {
        result.set(counterpart.id, counterpart);
        const nextIndex = sequence.beats.findIndex((beat) => beat.id === counterpart.time.beatId);
        pending.push({ performerId: counterpart.performerId, hand: counterpart.hand, beatIndex: nextIndex });
      }
    }
  }

  return [...result.values()].sort((left, right) => {
    const leftIndex = sequence.beats.findIndex((beat) => beat.id === left.time.beatId);
    const rightIndex = sequence.beats.findIndex((beat) => beat.id === right.time.beatId);
    return leftIndex - rightIndex || left.time.offset.numerator / left.time.offset.denominator - right.time.offset.numerator / right.time.offset.denominator;
  });
}
