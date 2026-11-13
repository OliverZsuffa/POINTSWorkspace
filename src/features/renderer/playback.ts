import type { InitialState, Sequence, SimulationResult } from '../../domain/model';

export function getLoopInitialState(sequence: Sequence, simulation: SimulationResult): InitialState | undefined {
  const lastBeat = sequence.beats[sequence.beats.length - 1];
  if (!lastBeat) return undefined;
  const finalSnapshot = simulation.snapshots.find((snapshot) =>
    snapshot.at.beatId === lastBeat.id && snapshot.phase === 'after',
  );
  if (!finalSnapshot) return undefined;
  const placements = sequence.balls.flatMap((ball) => {
    const location = finalSnapshot.ballLocations[ball.id];
    return location ? [{ ballId: ball.id, location }] : [];
  });
  return { placements };
}
