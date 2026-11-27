/**
 * The one chain-confirmation definition (OMN-124).
 *
 * A coin created in block `created` has `tip - created` confirmations at
 * `tipBlock` — zero while it sits in its creation block — and `null` when depth
 * cannot be proven (missing/invalid creation height, or a future-dated coin).
 * Callers must treat `null` as unconfirmed.
 *
 * `@totemsdk/chain-provider` and `@totemsdk/omnia` both re-use this function so
 * they cannot disagree about the same coin at a threshold boundary.
 */
export function confirmationDepth(
  created: string | number | undefined | null,
  tipBlock: number,
): number | null {
  if (created === undefined || created === null) return null;
  const value = Number(created);
  if (!Number.isSafeInteger(value) || value < 0) return null;
  if (!Number.isSafeInteger(tipBlock)) return null;
  if (value > tipBlock) return null;
  return tipBlock - value;
}
