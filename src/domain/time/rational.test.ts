import { describe, expect, it } from 'vitest';
import {
  addRational,
  compareRational,
  multiplyRational,
  rational,
  rationalToNumber,
} from './rational';

describe('rational time values', () => {
  it('normalises fractions and negative denominators', () => {
    expect(rational(6, 8)).toEqual({ numerator: 3, denominator: 4 });
    expect(rational(1, -2)).toEqual({ numerator: -1, denominator: 2 });
  });

  it('adds and multiplies without floating point drift', () => {
    expect(addRational(rational(1, 3), rational(1, 6))).toEqual({
      numerator: 1,
      denominator: 2,
    });
    expect(multiplyRational(rational(3, 8), 4)).toEqual({
      numerator: 3,
      denominator: 2,
    });
  });

  it('compares rational values by mathematical value', () => {
    expect(compareRational(rational(2, 4), rational(1, 2))).toBe(0);
    expect(compareRational(rational(1, 3), rational(1, 2))).toBe(-1);
    expect(rationalToNumber(rational(3, 2))).toBe(1.5);
  });

  it('rejects a zero denominator', () => {
    expect(() => rational(1, 0)).toThrow(RangeError);
  });
});
