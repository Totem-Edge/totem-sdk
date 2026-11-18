/**
 * omnia/units.ts — Omnia's amount contract.
 *
 * Chain providers return the node's decimal MINIMA text (`"0.2"`). Omnia's
 * channel, HTLC and funding maths is integer atoms (1 MINIMA = 10^44 atoms),
 * and every serialized coin amount is written as `MiniNumber(unscaled = atoms,
 * scale = 44)`.
 *
 * The boundary helper lives in `@totemsdk/core`; re-exported here so Omnia
 * consumers have one import for the contract.
 */

export { coinAmountAtoms } from '@totemsdk/core';
