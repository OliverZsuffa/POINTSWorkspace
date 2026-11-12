import { multiplyRational, rational, type Rational } from './rational';

export type NoteDenominator = 1 | 2 | 4 | 8 | 16 | 32 | 64;

export interface TimeSignature {
  readonly numerator: number;
  readonly denominator: NoteDenominator;
  /**
   * Each entry is a group of denominator-note units forming one main beat.
   * For example, 4/4 uses [1, 1, 1, 1], while compound 6/8 uses [3, 3].
   */
  readonly beatGrouping: readonly number[];
}

export function createTimeSignature(
  numerator: number,
  denominator: NoteDenominator,
  beatGrouping: readonly number[],
): TimeSignature {
  if (!Number.isSafeInteger(numerator) || numerator < 1) {
    throw new RangeError('The time signature numerator must be a positive integer.');
  }

  if (
    beatGrouping.length === 0 ||
    beatGrouping.some(
      (group) => !Number.isSafeInteger(group) || group < 1,
    )
  ) {
    throw new RangeError('A time signature needs positive integer beat groups.');
  }

  const groupedUnits = beatGrouping.reduce((total, group) => total + group, 0);

  if (groupedUnits !== numerator) {
    throw new RangeError('Beat groups must add up to the time signature numerator.');
  }

  return {
    numerator,
    denominator,
    beatGrouping: [...beatGrouping],
  };
}

export const DEFAULT_TIME_SIGNATURE = createTimeSignature(4, 4, [1, 1, 1, 1]);
export const SIX_EIGHT_TIME_SIGNATURE = createTimeSignature(6, 8, [3, 3]);

/** Returns the duration of one denominator note, measured in quarter notes. */
export function getDenominatorNoteDuration(
  signature: TimeSignature,
): Rational {
  return rational(4, signature.denominator);
}

/** Returns the duration of each main beat group, measured in quarter notes. */
export function getMainBeatDurations(
  signature: TimeSignature,
): readonly Rational[] {
  const noteDuration = getDenominatorNoteDuration(signature);

  return signature.beatGrouping.map((group) =>
    multiplyRational(noteDuration, group),
  );
}

/** Returns the duration of a complete bar, measured in quarter notes. */
export function getBarDuration(signature: TimeSignature): Rational {
  return multiplyRational(
    getDenominatorNoteDuration(signature),
    signature.numerator,
  );
}

export function getMainBeatsPerBar(signature: TimeSignature): number {
  return signature.beatGrouping.length;
}
