import type { Beat } from '../../domain/model';
import { rational, type Rational } from '../../domain/time/rational';

export interface TimelineSlot {
  readonly beatId: Beat['id'];
  readonly offset: Rational;
  readonly duration: Rational;
  readonly label: string;
}

export function getTimelineSlots(beats: readonly Beat[]): readonly TimelineSlot[] {
  return beats.map((beat, index) => ({
    beatId: beat.id,
    offset: rational(0),
    duration: rational(1),
    label: String(index + 1),
  }));
}
