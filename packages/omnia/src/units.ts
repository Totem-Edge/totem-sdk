/**
 * omnia/units.ts — Omnia's amount contract.
 *
 * Chain providers return the node's decimal MINIMA text (`"0.2"`). Omnia's
 * channel, HTLC and funding maths is integer atoms (1 MINIMA = 10^44 atoms),
 * and every serialized coin amount is written as `MiniNumber(unscaled = atoms,
 * scale = 44)`.
 *
 * Convert exactly once, at the point a chain coin enters Omnia.
 */

import { amountToAtoms } from '@totemsdk/core';

/**
 * Read an on-chain coin amount as integer atoms.
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
