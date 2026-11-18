/**
 * core/amount.ts — the Minima amount unit boundary.
 *
 * The node has exactly one amount type, `MiniNumber` (a `BigDecimal` capped at
 * 64 significant digits). Its two external forms are:
 *
 *  - **JSON** (`coins`, `coinexport`): `MiniNumber.toString()` =
 *    `stripTrailingZeros().toPlainString()`, i.e. decimal MINIMA text (`"0.2"`).
 *  - **Binary transaction**: `MiniNumber.writeDataStream()` writes
 *    `(scale, unscaled)`, where value = `unscaled × 10^-scale`.
 *
 * `MiniNumber.MAX_DECIMAL_PLACES = MAX_DIGITS (64) - 20 = 44`, so the smallest
 * representable unit is `1E-44` MINIMA. The SDK calls that unit an **atom**:
 * 1 MINIMA = 10^44 atoms. Coin math (balances, HTLCs, channel totals) is done
 * in atoms so it stays exact integer arithmetic; every serialized amount is
 * written as `(unscaled = atoms, scale = 44)`.
 *
 * Chain providers hand out the node's decimal text unchanged. Convert once,
 * where an atom amount is actually needed.
 */

/** Minima has 44 decimal places: 1 MINIMA = 10^44 atoms. */
export const MINIMA_DECIMALS = 44;

const ATOMS_PER_MINIMA = 10n ** BigInt(MINIMA_DECIMALS);
const DECIMAL = /^\d*(\.\d*)?$/;

/**
 * Convert decimal MINIMA text (`"0.2"`) to atoms (`2000...0n`).
 *
 * Exact by construction: a fraction longer than 44 places is rejected when it
 * carries value, and anything that is not a non-negative plain decimal is
 * rejected. Fail closed — truncating here would silently change the amount.
 */
export function amountToAtoms(value: string): bigint {
  const text = value.trim();
  if (!DECIMAL.test(text) || text === '' || text === '.') {
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
  return BigInt(whole || '0') * ATOMS_PER_MINIMA + BigInt(padded || '0');
}

/**
 * Read a coin amount as atoms at a trust boundary.
 *
 * `ChainStateProvider` returns decimal MINIMA text, which is the production
 * form. A `bigint` (or a safe integer `number`) can only be an atom count, so
 * it is taken verbatim — useful for internal callers and test doubles. A
 * fractional `number` is rejected rather than guessed at.
 */
export function coinAmountAtoms(coin: { amount: string | number | bigint }): bigint {
  const { amount } = coin;
  if (typeof amount === 'bigint') {
    if (amount < 0n) throw new Error(`coin amount must be non-negative, received ${amount}`);
    return amount;
  }
  if (typeof amount === 'number') {
    if (!Number.isSafeInteger(amount) || amount < 0) {
      throw new Error(
        `coin amount ${amount} is not a non-negative integer; pass decimal MINIMA text instead`,
      );
    }
    return BigInt(amount);
  }
  return amountToAtoms(amount);
}

/** Convert atoms back to decimal MINIMA text (`"0.2"`). */
export function atomsToAmount(atoms: bigint): string {
  if (atoms < 0n) throw new Error(`atoms must be non-negative, received ${atoms}`);
  const whole = atoms / ATOMS_PER_MINIMA;
  const fraction = (atoms % ATOMS_PER_MINIMA)
    .toString()
    .padStart(MINIMA_DECIMALS, '0')
    .replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

/**
 * The `MiniNumber(unscaled, scale)` pair for an atom amount, as Java's
 * `MiniNumber.writeDataStream()` expects it.
 */
export function atomsToMiniNumber(atoms: bigint): { unscaled: bigint; scale: number } {
  if (atoms < 0n) throw new Error(`atoms must be non-negative, received ${atoms}`);
  return { unscaled: atoms, scale: MINIMA_DECIMALS };
}
