import { describe, expect, it } from 'vitest';
import {
  createTimeSignature,
  DEFAULT_TIME_SIGNATURE,
  getBarDuration,
  getMainBeatDurationSeconds,
  getMainBeatDurations,
  getMainBeatsPerBar,
  getQuarterNoteDurationSeconds,
  SIX_EIGHT_TIME_SIGNATURE,
} from './time-signature';

describe('musical time signatures', () => {
  it('models 4/4 as four quarter note main beats', () => {
    expect(getMainBeatsPerBar(DEFAULT_TIME_SIGNATURE)).toBe(4);
    expect(getMainBeatDurations(DEFAULT_TIME_SIGNATURE)).toEqual([
      { numerator: 1, denominator: 1 },
      { numerator: 1, denominator: 1 },
      { numerator: 1, denominator: 1 },
      { numerator: 1, denominator: 1 },
    ]);
    expect(getBarDuration(DEFAULT_TIME_SIGNATURE)).toEqual({
      numerator: 4,
      denominator: 1,
    });
  });

  it('models compound 6/8 as two dotted quarter note main beats', () => {
    expect(getMainBeatsPerBar(SIX_EIGHT_TIME_SIGNATURE)).toBe(2);
    expect(getMainBeatDurations(SIX_EIGHT_TIME_SIGNATURE)).toEqual([
      { numerator: 3, denominator: 2 },
      { numerator: 3, denominator: 2 },
    ]);
    expect(getBarDuration(SIX_EIGHT_TIME_SIGNATURE)).toEqual({
      numerator: 3,
      denominator: 1,
    });
  });

  it('uses quarter note BPM to calculate simple and compound beat durations', () => {
    expect(getQuarterNoteDurationSeconds(120)).toBe(0.5);
    expect(getMainBeatDurationSeconds(DEFAULT_TIME_SIGNATURE, 0, 120)).toBe(0.5);
    expect(getMainBeatDurationSeconds(SIX_EIGHT_TIME_SIGNATURE, 0, 120)).toBe(0.75);
  });

  it('rejects groupings that do not fill the bar', () => {
    expect(() => createTimeSignature(6, 8, [3, 2])).toThrow(RangeError);
  });

  it('rejects invalid tempo values', () => {
    expect(() => getQuarterNoteDurationSeconds(0)).toThrow(RangeError);
  });
});
