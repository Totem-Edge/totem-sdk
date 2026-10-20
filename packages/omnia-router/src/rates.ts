/** Fixed-point scale shared by routing fees and swap rates. */
export const SCALE = 100_000_000n;

/**
 * Parse a decimal rate string to a scaled bigint (SCALE = 10^8).
 * "0.95" → 95_000_000n, "1.5" → 150_000_000n, "2" → 200_000_000n.
 */
export function parseRateToScaled(rate: string): bigint {
  const neg = rate.startsWith('-');
  const abs = neg ? rate.slice(1) : rate;
  const dot = abs.indexOf('.');
  const intPart  = dot === -1 ? abs : (abs.slice(0, dot) || '0');
  const fracFull = dot === -1 ? '' : abs.slice(dot + 1);
  const fracStr  = fracFull.slice(0, 8).padEnd(8, '0');
  const ninth    = fracFull.length > 8 ? parseInt(fracFull[8] ?? '0', 10) : 0;
  const result   = BigInt(intPart) * SCALE + BigInt(fracStr) + (ninth >= 5 ? 1n : 0n);
  return neg ? -result : result;
}

/** Apply rate to amount: amountOut = amountIn × rateScaled / SCALE */
export function applyRate(amountIn: bigint, rate: string): bigint {
  const rateScaled = parseRateToScaled(rate);
  return (amountIn * rateScaled) / SCALE;
}
