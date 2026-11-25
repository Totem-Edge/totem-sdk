/**
 * Amount arithmetic for the LSP packages.
 *
 * Re-exported from `@totemsdk/core` so the provider, the router and the pool
 * cannot drift into different rounding or precision rules (OMN-071). Kept as a
 * local entry point because it is part of this package's public surface.
 */

export {
  AMOUNT_SCALE,
  addAmounts,
  applyBps,
  compareAmounts,
  effectiveBps,
  formatDecimalAmount,
  gte,
  parseDecimalAmount,
  subAmounts,
} from '@totemsdk/core';

/** Backwards-compatible alias; the scale is shared, not LSP-specific. */
export { AMOUNT_SCALE as LSP_AMOUNT_SCALE } from '@totemsdk/core';
