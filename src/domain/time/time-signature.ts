import { multiplyRational, rational, rationalToNumber, type Rational } from './rational';

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
    ![1, 2, 4, 8, 16, 32, 64].includes(denominator) ||
    beatGrouping.length === 0 ||
    beatGrouping.some((group) => !Number.isSafeInteger(group) || group < 1)
  ) {
    throw new RangeError('A time signature needs a valid denominator and positive beat groups.');
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
export function getDenominatorNoteDuration(signature: TimeSignature): Rational {
  return rational(4, signature.denominator);
}

/** Returns the duration of each main beat group, measured in quarter notes. */
export function getMainBeatDurations(signature: TimeSignature): readonly Rational[] {
  const noteDuration = getDenominatorNoteDuration(signature);

  return signature.beatGrouping.map((group) => multiplyRational(noteDuration, group));
}

/** Returns the duration of a complete bar, measured in quarter notes. */
export function getBarDuration(signature: TimeSignature): Rational {
  return multiplyRational(getDenominatorNoteDuration(signature), signature.numerator);
}

export function getMainBeatsPerBar(signature: TimeSignature): number {
  return signature.beatGrouping.length;
}

/** BPM is quarter notes per minute, regardless of the time signature denominator. */
export function getQuarterNoteDurationSeconds(bpm: number): number {
  if (!Number.isFinite(bpm) || bpm <= 0) {
    throw new RangeError('BPM must be a positive finite number.');
  }

  return 60 / bpm;
}

/** Returns the duration of a main beat at the supplied zero-based bar position. */
export function getMainBeatDurationSeconds(
  signature: TimeSignature,
  mainBeatIndex: number,
  bpm: number,
): number {
  if (!Number.isSafeInteger(mainBeatIndex) || mainBeatIndex < 0) {
    throw new RangeError('The main beat index must be a non-negative integer.');
  }

  const beatDuration = getMainBeatDurations(signature)[
    mainBeatIndex % signature.beatGrouping.length
  ];

  if (!beatDuration) {
    throw new RangeError('The time signature does not define this main beat.');
  }

  return rationalToNumber(beatDuration) * getQuarterNoteDurationSeconds(bpm);
}
