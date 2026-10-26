/**
 * Node-aware token amount conversion (RFC-057-adjacent correctness boundary).
 *
 * Omnia and the generic RPC transport carry **raw** amounts. Some node
 * commands (notably `txninput` with a floating token input) interpret a token
 * amount in token units and convert it to raw units in Java. That conversion is
 * a node-version behaviour; doing it implicitly in the generic transport would
 * double-convert values and silently corrupt settlement amounts.
 *
 * Convert explicitly, at the builder boundary, with this helper.
 */

const DECIMAL = /^[0-9]+(?:\.[0-9]+)?$/;

/**
 * Convert a human token amount (e.g. `"1.5"`) to the token's smallest raw unit
 * for a known token scale (`8` → `"150000000"`).
 *
 * @throws when the amount is negative/NaN or carries more decimal places than
 *   the token scale allows (that would be a fractional raw unit).
 */
export function toRawTokenAmount(amount: string, tokenScale: number): string {
  if (!Number.isInteger(tokenScale) || tokenScale < 0 || tokenScale > 18) {
    throw new Error(`toRawTokenAmount: invalid token scale ${String(tokenScale)}`);
  }
  if (!DECIMAL.test(amount)) {
    throw new Error(`toRawTokenAmount: invalid non-negative decimal amount ${JSON.stringify(amount)}`);
  }
  const [whole, frac = ''] = amount.split('.');
  const significantFrac = frac.replace(/0+$/, '');
  if (significantFrac.length > tokenScale) {
    throw new Error(
      `toRawTokenAmount: ${amount} has more than ${tokenScale} decimal place(s)`,
    );
  }
  const scaled = whole + significantFrac.padEnd(tokenScale, '0');
  return scaled.replace(/^0+(?=\d)/, '');
}
