/**
 * Signing helpers — wraps TreeKey.sign() + serializeTreeSignature
 * into the hex string the /wots-hardened/finalize endpoint expects.
 */
import { serializeTreeSignature, type TreeKey } from '@totemsdk/core';
import { toHex } from './utils';

/**
 * Sign `data` with an explicitly allocated WOTS leaf index.
 *
 * WOTS leaves are one-time keys, so callers MUST pass the unique index they
 * reserved (via a lease or the persistent per-address counter). Never sign from
 * a freshly derived TreeKey without an explicit index — that reuses leaf 0
 * (AUD-001).
 */
export async function signAndSerialize(
  treeKey: TreeKey,
  data: Uint8Array,
  uses: number,
): Promise<string> {
  if (!Number.isInteger(uses) || uses < 0) {
    throw new Error(`Invalid WOTS uses index: ${uses}`);
  }
  if (uses >= treeKey.getMaxUses()) {
    throw new Error(`WOTS uses index ${uses} exceeds tree capacity ${treeKey.getMaxUses()}`);
  }
  treeKey.setUses(uses);
  const treeSig = treeKey.sign(data);
  const bytes = serializeTreeSignature(treeSig) as Uint8Array;
  return '0x' + toHex(bytes);
}
