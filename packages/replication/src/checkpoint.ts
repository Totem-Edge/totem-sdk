/** Signed/verified checkpoint identifiers (opaque, not finality). */

import { sha3_256, bytesToHex, hexToBytes, verifyTreeSignature, deserializeTreeSignature } from '@totemsdk/core';

export interface Checkpoint {
  readonly datasetId: string;
  readonly datasetVersion: number;
  readonly length: number;
  readonly root: string;
  readonly signature?: string;
  readonly signerPublicKey?: string;
}

export function computeCheckpointDigest(cp: Omit<Checkpoint, 'signature' | 'signerPublicKey'>): string {
  const bytes = new TextEncoder().encode(
    ['totemsdk/replication/checkpoint/v1', cp.datasetId, String(cp.datasetVersion), String(cp.length), cp.root].join('|'),
  );
  return '0x' + bytesToHex(sha3_256(bytes));
}

/** Verify a checkpoint's tree signature against its declared signer key. */
export function verifyCheckpoint(cp: Checkpoint): boolean {
  if (!cp.signature || !cp.signerPublicKey) return false;
  try {
    const digest = hexToBytes(computeCheckpointDigest(cp).slice(2));
    const sig = deserializeTreeSignature(hexToBytes(cp.signature.replace(/^0x/, '')));
    return verifyTreeSignature(hexToBytes(cp.signerPublicKey.replace(/^0x/, '')), digest, sig);
  } catch {
    return false;
  }
}
