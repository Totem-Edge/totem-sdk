import { sha3_256 } from '@totemsdk/core';

/**
 * Compute the canonical 32-byte state commitment for N-of-N factory signing.
 *
 * Covers:
 *   - factoryId        (factory context isolation)
 *   - sequence         (monotonicity; prevents replay of old state)
 *   - pendingAllocations (the proposed allocation split being signed)
 *   - virtualChannelIds (list of currently open VCs; prevents forgery of VC state)
 *
 * All fields are sorted lexicographically for determinism regardless of the
 * order in which keys appear in the caller's objects.
 *
 * This commitment is what every party signs via `FactorySignerOps.sign`, and
 * what `FactorySignerOps.verify` checks against each stored signature.
 */
export function computeFactoryStateCommitment(
  factoryId: string,
  sequence: number,
  pendingAllocations: Record<string, bigint>,
  virtualChannelIds: string[],
): Uint8Array {
  const canonical = {
    factoryId,
    sequence,
    allocations: Object.fromEntries(
      Object.entries(pendingAllocations)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, v.toString()]),
    ),
    virtualChannelIds: [...virtualChannelIds].sort(),
  };
  return sha3_256(new TextEncoder().encode(JSON.stringify(canonical)));
}
