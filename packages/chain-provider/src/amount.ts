/**
 * chain-provider/amount.ts — unit boundary between the node and the SDK.
 *
 * Minima's RPC reports coin amounts as decimal MINIMA (`"0.2"`), while the
 * Omnia channel/HTLC/router maths, the funding drafts and the wire formats all
 * work in raw atoms. `BigInt("0.2")` throws, so a decimal amount reaching that
 * code surfaces as `Cannot convert 0.2 to a BigInt` after the host has already
 * committed to opening a channel.
 *
 * Convert once, at the adapter boundary (`MinimaRpcProvider.getCoins` /
 * `getCoin`), so every chain-truth consumer sees one unit.
 */

/** Minima has 44 decimal places: 1 MINIMA = 10^44 atoms. */
export const MINIMA_DECIMALS = 44;

/**
 * Convert a decimal MINIMA/token amount to a raw-integer amount string.
 *
 * Exact by construction: a fraction longer than 44 places is only rejected when
 * it actually carries value, and anything that is not a non-negative decimal is
 * rejected outright. Fail closed — truncating here would silently change the
 * funded amount.
 */
export function amountToAtoms(value: string | bigint | number): string {
  if (typeof value === 'bigint') {
    if (value < 0n) throw new Error(`amount must be non-negative, received ${value}`);
    return value.toString();
  }
  const text = String(value).trim();
  if (!/^\d*(\.\d*)?$/.test(text) || text === '' || text === '.') {
    throw new Error(`amount '${value}' is not a non-negative decimal`);
  }
  const [whole = '0', fraction = ''] = text.split('.');
  const excess = fraction.slice(MINIMA_DECIMALS);
  if (/[1-9]/.test(excess)) {
    throw new Error(
      `amount '${value}' has more than ${MINIMA_DECIMALS} decimal places and cannot be represented exactly`,
    );
  }
  const padded = (fraction + '0'.repeat(MINIMA_DECIMALS)).slice(0, MINIMA_DECIMALS);
  return (BigInt(whole || '0') * 10n ** BigInt(MINIMA_DECIMALS) + BigInt(padded || '0')).toString();
}
