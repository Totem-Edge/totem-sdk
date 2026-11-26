/**
 * Strict fixed-point decimal parsing for LSP wire amounts (OMN-073).
 *
 * Every LSP amount crosses the wire as a decimal string in whole token units.
 * The two parsers this replaces truncated fractional precision beyond 18 places
 * and mis-signed negative input — `-1.5` parsed as `-0.5`, because they
 * multiplied the whole part and then *added* the fraction. They also let
 * malformed input reach `BigInt()`, which throws an opaque SyntaxError instead
 * of producing a policy refusal.
 *
 * There is one parser now, and it rejects rather than rounds.
 */

/** Fractional precision the LSP wire format supports. */
export const LSP_DECIMAL_SCALE = 18;

const SCALE_FACTOR = 10n ** BigInt(LSP_DECIMAL_SCALE);

/** Canonical: no sign, no leading zeros, no bare `.5`, no exponent. */
const CANONICAL_DECIMAL = /^(0|[1-9][0-9]*)(?:\.([0-9]+))?$/;

export type DecimalParseResult =
  | { ok: true; units: bigint; canonical: string }
  | { ok: false; error: string };

/**
 * Parse a decimal string into integer units at `LSP_DECIMAL_SCALE`.
 *
 * Rejects negatives, signs, exponents, leading zeros, empty fractions and any
 * precision beyond 18 decimal places. Zero is rejected unless `allowZero`.
 */
export function parseDecimalUnits(
  value: string,
  options: { allowZero?: boolean } = {},
): DecimalParseResult {
  if (typeof value !== 'string' || value.length === 0) {
    return { ok: false, error: 'amount must be a non-empty decimal string' };
  }
  const match = CANONICAL_DECIMAL.exec(value);
  if (!match) {
    return { ok: false, error: `'${value}' is not a canonical non-negative decimal` };
  }
  const whole = match[1] as string;
  const fraction = match[2] ?? '';
  if (fraction.length > LSP_DECIMAL_SCALE) {
    return {
      ok: false,
      error: `'${value}' has more than ${LSP_DECIMAL_SCALE} decimal places`,
    };
  }
  const units = BigInt(whole) * SCALE_FACTOR
    + BigInt(fraction.padEnd(LSP_DECIMAL_SCALE, '0'));
  if (units === 0n && options.allowZero !== true) {
    return { ok: false, error: 'amount must be positive' };
  }
  return { ok: true, units, canonical: formatDecimalUnits(units) };
}

/** Render integer units at `LSP_DECIMAL_SCALE` as a canonical decimal string. */
export function formatDecimalUnits(units: bigint): string {
  const negative = units < 0n;
  const absolute = negative ? -units : units;
  const whole = absolute / SCALE_FACTOR;
  const fraction = absolute % SCALE_FACTOR;
  const fractionText = fraction
    .toString()
    .padStart(LSP_DECIMAL_SCALE, '0')
    .replace(/0+$/, '');
  return `${negative ? '-' : ''}${whole.toString()}${fractionText ? `.${fractionText}` : ''}`;
}

/** Whole-number basis points of an integer-unit amount, floored. */
export function applyBpsUnits(units: bigint, bps: number): bigint {
  if (!Number.isInteger(bps) || bps < 0) {
    throw new Error(`basis points must be a non-negative integer, got ${bps}`);
  }
  return (units * BigInt(bps)) / 10_000n;
}
