/** Deterministic pro-rata yield distribution for multiparty VTXO/pool claims. */
export function distributeYield(
  total: bigint,
  weights: Record<string, bigint>,
): Record<string, bigint> {
  if (total < 0n) throw new Error('yield total must be non-negative');
  const entries = Object.entries(weights).filter(([, weight]) => weight > 0n);
  if (entries.length === 0) throw new Error('yield requires positive weights');
  const denominator = entries.reduce((sum, [, weight]) => sum + weight, 0n);
  if (denominator <= 0n) throw new Error('yield weight sum must be positive');

  const out: Record<string, bigint> = {};
  let allocated = 0n;
  for (const [id, weight] of entries) {
    const share = (total * weight) / denominator;
    out[id] = share;
    allocated += share;
  }
  // Deterministic remainder assignment to the first entry.
  const remainder = total - allocated;
  if (remainder > 0n) out[entries[0][0]] += remainder;
  return out;
}
