import type { Beat, Subdivision } from '../../domain/model';
import { addRational, rational, type Rational } from '../../domain/time/rational';

export interface TimelineSlot {
  readonly beatId: Beat['id'];
  readonly offset: Rational;
  readonly duration: Rational;
  readonly depth: number;
  readonly label: string;
}

const ZERO = rational(0);
const ONE = rational(1);

function compare(left: Rational, right: Rational): number {
  return left.numerator * right.denominator - right.numerator * left.denominator;
}

function equal(left: Rational, right: Rational): boolean {
  return compare(left, right) === 0;
}

function implicitSubdivision(): Subdivision {
  return { id: 'implicit-root' as Subdivision['id'], start: ZERO, duration: ONE, depth: 0 };
}

function subdivisionLabel(start: Rational, depth: number, beatNumber: number): string {
  if (equal(start, ZERO)) return String(beatNumber);
  if (depth === 1 && equal(start, rational(1, 2))) return '&';
  if (depth >= 2) {
    const sixteenthLabels = new Map([
      ['1/4', 'e'],
      ['1/2', '&'],
      ['3/4', 'a'],
    ]);
    const key = start.numerator + '/' + start.denominator;
    const conventional = sixteenthLabels.get(key);
    if (conventional) return conventional;
  }
  return '+' + start.numerator + '/' + start.denominator;
}

export function getTimelineSlots(beats: readonly Beat[]): readonly TimelineSlot[] {
  return beats.flatMap((beat, beatIndex) => {
    const intervals = beat.subdivisions.length ? beat.subdivisions : [implicitSubdivision()];
    return [...intervals]
      .sort((left, right) => compare(left.start, right.start))
      .map((interval) => ({
        beatId: beat.id,
        offset: interval.start,
        duration: interval.duration,
        depth: interval.depth,
        label: subdivisionLabel(interval.start, interval.depth, beatIndex + 1),
      }));
  });
}

export function splitSubdivision(
  beat: Beat,
  offset: Rational,
  duration: Rational,
  createId: () => Subdivision['id'],
): Beat {
  const intervals = beat.subdivisions.length ? [...beat.subdivisions] : [implicitSubdivision()];
  const index = intervals.findIndex((item) => equal(item.start, offset) && equal(item.duration, duration));
  if (index < 0) return beat;
  const current = intervals[index]!;
  const half = rational(current.duration.numerator, current.duration.denominator * 2);
  const middle = addRational(current.start, half);
  const children: Subdivision[] = [
    { id: createId(), start: current.start, duration: half, depth: current.depth + 1 },
    { id: createId(), start: middle, duration: half, depth: current.depth + 1 },
  ];
  intervals.splice(index, 1, ...children);
  return { ...beat, subdivisions: intervals };
}
