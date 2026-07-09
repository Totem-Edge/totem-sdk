/**
 * Signing helpers — wraps TreeKey.sign() + serializeTreeSignature
 * into the hex string the /wots-hardened/finalize endpoint expects.
 */
import { serializeTreeSignature, type TreeKey } from '@totemsdk/core';
import { toHex } from './utils';

export async function signAndSerialize(treeKey: TreeKey, data: Uint8Array): Promise<string> {
  const treeSig = treeKey.sign(data);
  const bytes = serializeTreeSignature(treeSig) as Uint8Array;
  return '0x' + toHex(bytes);
}
