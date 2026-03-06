/**
 * Decimal Utility Module
 * 
 * Provides precision-safe arithmetic operations for financial calculations.
 * Uses decimal.js-light to avoid floating-point precision errors.
 * 
 * Requirements:
 * - 12.1: Use fixed-point decimal arithmetic for all monetary calculations
 * - 12.2: Maintain at least 18 decimal places of precision for token quantities
 * - 12.3: Maintain at least 8 decimal places of precision for USD values
 * - 12.4: Use banker's rounding (round half to even) for division operations
 */

import Decimal from 'decimal.js-light';

// Configure Decimal.js for financial calculations
// Token quantities: 18 decimal places
export const TOKEN_PRECISION = 18;
// USD values: 8 decimal places
export const USD_PRECISION = 8;

// Configure Decimal.js defaults
Decimal.set({
  precision: 40, // Internal precision (higher than needed for intermediate calculations)
  rounding: Decimal.ROUND_HALF_EVEN, // Banker's rounding (round half to even)
  toExpNeg: -40,
  toExpPos: 40,
});

/**
 * Create a Decimal instance from a number, string, or Decimal
 * @param value - The value to convert to Decimal
 * @returns Decimal instance
 */
export function toDecimal(value: number | string | Decimal): Decimal {
  if (value instanceof Decimal) {
    return value;
  }
  return new Decimal(value);
}

/**
 * Safe addition of two decimal values
 * @param a - First value
 * @param b - Second value
 * @returns Sum as Decimal
 */
export function add(a: number | string | Decimal, b: number | string | Decimal): Decimal {
  return toDecimal(a).plus(toDecimal(b));
}

/**
 * Safe subtraction of two decimal values
 * @param a - First value (minuend)
 * @param b - Second value (subtrahend)
 * @returns Difference as Decimal
 */
export function subtract(a: number | string | Decimal, b: number | string | Decimal): Decimal {
  return toDecimal(a).minus(toDecimal(b));
}

/**
 * Safe multiplication of two decimal values
 * @param a - First value
 * @param b - Second value
 * @returns Product as Decimal
 */
export function multiply(a: number | string | Decimal, b: number | string | Decimal): Decimal {
  return toDecimal(a).times(toDecimal(b));
}

/**
 * Safe division of two decimal values with banker's rounding
 * @param a - Dividend
 * @param b - Divisor
 * @returns Quotient as Decimal
 * @throws Error if divisor is zero
 */
export function divide(a: number | string | Decimal, b: number | string | Decimal): Decimal {
  const divisor = toDecimal(b);
  if (divisor.isZero()) {
    throw new Error('Division by zero');
  }
  return toDecimal(a).dividedBy(divisor);
}

/**
 * Round a decimal value to specified decimal places using banker's rounding
 * Banker's rounding (round half to even): when the value is exactly halfway between
 * two numbers, round to the nearest even number.
 * 
 * Examples:
 * - 2.5 rounds to 2 (even)
 * - 3.5 rounds to 4 (even)
 * - 2.4 rounds to 2
 * - 2.6 rounds to 3
 * 
 * @param value - Value to round
 * @param decimalPlaces - Number of decimal places to round to
 * @returns Rounded Decimal
 */
export function bankersRound(value: number | string | Decimal, decimalPlaces: number): Decimal {
  return toDecimal(value).toDecimalPlaces(decimalPlaces, Decimal.ROUND_HALF_EVEN);
}

/**
 * Round a token quantity to the standard precision (18 decimal places)
 * @param value - Token quantity to round
 * @returns Rounded Decimal with 18 decimal places
 */
export function roundTokenQuantity(value: number | string | Decimal): Decimal {
  return bankersRound(value, TOKEN_PRECISION);
}

/**
 * Round a USD value to the standard precision (8 decimal places)
 * @param value - USD value to round
 * @returns Rounded Decimal with 8 decimal places
 */
export function roundUsdValue(value: number | string | Decimal): Decimal {
  return bankersRound(value, USD_PRECISION);
}

/**
 * Compare two decimal values
 * @param a - First value
 * @param b - Second value
 * @returns -1 if a < b, 0 if a === b, 1 if a > b
 */
export function compare(a: number | string | Decimal, b: number | string | Decimal): number {
  return toDecimal(a).comparedTo(toDecimal(b));
}

/**
 * Check if a decimal value is zero
 * @param value - Value to check
 * @returns true if value is zero
 */
export function isZero(value: number | string | Decimal): boolean {
  return toDecimal(value).isZero();
}

/**
 * Check if a decimal value is positive
 * @param value - Value to check
 * @returns true if value is greater than zero
 */
export function isPositive(value: number | string | Decimal): boolean {
  return toDecimal(value).greaterThan(0);
}

/**
 * Check if a decimal value is negative
 * @param value - Value to check
 * @returns true if value is less than zero
 */
export function isNegative(value: number | string | Decimal): boolean {
  return toDecimal(value).lessThan(0);
}

/**
 * Get the minimum of two decimal values
 * @param a - First value
 * @param b - Second value
 * @returns Minimum value as Decimal
 */
export function min(a: number | string | Decimal, b: number | string | Decimal): Decimal {
  const decimalA = toDecimal(a);
  const decimalB = toDecimal(b);
  return decimalA.lessThanOrEqualTo(decimalB) ? decimalA : decimalB;
}

/**
 * Get the maximum of two decimal values
 * @param a - First value
 * @param b - Second value
 * @returns Maximum value as Decimal
 */
export function max(a: number | string | Decimal, b: number | string | Decimal): Decimal {
  const decimalA = toDecimal(a);
  const decimalB = toDecimal(b);
  return decimalA.greaterThanOrEqualTo(decimalB) ? decimalA : decimalB;
}

/**
 * Get the absolute value of a decimal
 * @param value - Value to get absolute value of
 * @returns Absolute value as Decimal
 */
export function abs(value: number | string | Decimal): Decimal {
  return toDecimal(value).abs();
}

/**
 * Sum an array of decimal values
 * @param values - Array of values to sum
 * @returns Sum as Decimal
 */
export function sum(values: (number | string | Decimal)[]): Decimal {
  return values.reduce<Decimal>((acc, val) => add(acc, val), new Decimal(0));
}

/**
 * Convert a Decimal to a string representation
 * @param value - Decimal value
 * @param decimalPlaces - Optional number of decimal places to format to
 * @returns String representation
 */
export function toString(value: Decimal, decimalPlaces?: number): string {
  if (decimalPlaces !== undefined) {
    return value.toFixed(decimalPlaces);
  }
  return value.toString();
}

/**
 * Convert a Decimal to a number (use with caution - may lose precision)
 * @param value - Decimal value
 * @returns Number representation
 */
export function toNumber(value: Decimal): number {
  return value.toNumber();
}

// Export Decimal class for direct use when needed
export { Decimal };
