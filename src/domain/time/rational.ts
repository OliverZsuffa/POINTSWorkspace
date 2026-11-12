export interface Rational {
  readonly numerator: number;
  readonly denominator: number;
}

function greatestCommonDivisor(a: number, b: number): number {
  let left = Math.abs(a);
  let right = Math.abs(b);

  while (right !== 0) {
    [left, right] = [right, left % right];
  }

  return left;
}

export function rational(numerator: number, denominator = 1): Rational {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator)) {
    throw new TypeError('Rational values must use safe integers.');
  }

  if (denominator === 0) {
    throw new RangeError('A rational denominator cannot be zero.');
  }

  const sign = denominator < 0 ? -1 : 1;
  const divisor = greatestCommonDivisor(numerator, denominator);

  return {
    numerator: (numerator / divisor) * sign,
    denominator: Math.abs(denominator / divisor),
  };
}

export const ZERO = rational(0);
export const ONE = rational(1);

export function addRational(left: Rational, right: Rational): Rational {
  return rational(
    left.numerator * right.denominator + right.numerator * left.denominator,
    left.denominator * right.denominator,
  );
}

export function multiplyRational(value: Rational, factor: number): Rational {
  if (!Number.isSafeInteger(factor)) {
    throw new TypeError('A rational multiplier must be a safe integer.');
  }

  return rational(value.numerator * factor, value.denominator);
}

export function compareRational(left: Rational, right: Rational): -1 | 0 | 1 {
  const difference =
    left.numerator * right.denominator - right.numerator * left.denominator;

  return difference < 0 ? -1 : difference > 0 ? 1 : 0;
}

export function rationalToNumber(value: Rational): number {
  return value.numerator / value.denominator;
}
