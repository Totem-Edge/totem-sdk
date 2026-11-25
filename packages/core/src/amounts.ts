/**
 * Exact decimal amounts (OMN-071).
 *
 * Every package that moves value parses amounts from decimal strings. Before
 * this module each one did it itself, with different rounding and different
 * tolerance for malformed input: one split on '.' and let `BigInt` silently
 * truncate anything past 18 decimals, another compared with `Number()` and lost
 * precision above 2^53. Those copies are how a "valid" amount could mean two
 * different things in the same transaction.
 *
 * Everything here is exact, rejects malformed input instead of coercing it, and
 * produces a canonical string form so a value that was compared is the value
 * that gets signed.
 */

/** Fixed-point scale for amount arithmetic (not a token's own scale). */
export const AMOUNT_SCALE = 18;
const FACTOR = 10n ** BigInt(AMOUNT_SCALE);

/**
 * Parse a non-negative decimal string exactly.
 *
 * Returns null for anything that is not `digits[.digits]`: no sign, no
 * exponent, no whitespace, no hex, and no more than 18 fractional digits.
 */
export function parseDecimalAmount(value: string): bigint | null {
  if (typeof value !== 'string') return null;
  // No trimming: a padded amount is malformed, and accepting it means the value
  // that was compared is not the value that was signed.
  if (!/^\d+(?:\.\d+)?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  if (fraction.length > AMOUNT_SCALE) return null;
  return BigInt(whole) * FACTOR + BigInt(fraction.padEnd(AMOUNT_SCALE, '0') || '0');
}

/** Canonical decimal string for a fixed-point value. */
export function formatDecimalAmount(value: bigint): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / FACTOR;
  const fraction = absolute % FACTOR;
  const fractionText = fraction
    .toString()
    .padStart(AMOUNT_SCALE, '0')
    .replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole.toString()}${fractionText ? `.${fractionText}` : ''}`;
}

export function addAmounts(a: string, b: string): string | null {
  const left = parseDecimalAmount(a);
  const right = parseDecimalAmount(b);
  if (left === null || right === null) return null;
  return formatDecimalAmount(left + right);
}

export function subAmounts(a: string, b: string): string | null {
  const left = parseDecimalAmount(a);
  const right = parseDecimalAmount(b);
  if (left === null || right === null || left < right) return null;
  return formatDecimalAmount(left - right);
}

export function compareAmounts(a: string, b: string): number | null {
  const left = parseDecimalAmount(a);
  const right = parseDecimalAmount(b);
  if (left === null || right === null) return null;
  return left === right ? 0 : left > right ? 1 : -1;
}

export function gte(a: string, b: string): boolean {
  const comparison = compareAmounts(a, b);
  return comparison !== null && comparison >= 0;
}

/** `amount * bps / 10_000`, floor. */
export function applyBps(amount: string, bps: number): string | null {
  if (!Number.isInteger(bps) || bps < 0) return null;
  const atoms = parseDecimalAmount(amount);
  if (atoms === null) return null;
  return formatDecimalAmount((atoms * BigInt(bps)) / 10_000n);
}

/**
 * Effective basis points of `amount` over `basis`, rounded up so a fee that is
 * even fractionally above a limit is rejected rather than rounded away.
 */
export function effectiveBps(amount: string, basis: string): number | null {
  const numerator = parseDecimalAmount(amount);
  const denominator = parseDecimalAmount(basis);
  if (numerator === null || denominator === null || denominator === 0n) return null;
  const scaled = (numerator * 10_000n + denominator - 1n) / denominator;
  if (scaled > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(scaled);
}
