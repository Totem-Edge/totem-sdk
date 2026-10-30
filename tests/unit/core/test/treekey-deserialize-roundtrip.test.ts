/**
 * Regression test for MMR proof byte-offset bug in deserializeTreeSignature.
 *
 * Previously, deserializeTreeSignature calculated how many bytes parseMMRProofFromHex
 * consumed using a hardcoded formula:
 *   3 + 3 + (chunks.length * (1 + 32 + 3))
 *
 * This was wrong in two ways:
 * 1. Each chunk is 40 bytes (1 isLeft + 4-byte length prefix + 32 hash), not 36.
 * 2. blockTime and numChunks headers are variable-length MiniNumbers, not always 3 bytes.
 *
 * The fix: parseMMRProofFromHex now returns bytesRead (the actual offset consumed),
 * which deserializeTreeSignature uses instead of the hardcoded formula.
 *
 * These tests serialize a TreeSignature and deserialize it, then verify it verifies
 * correctly — catching any byte-offset drift across all three proof levels.
 */

import { sha3_256 } from '@totemsdk/core';
import {
  TreeKey,
  verifyTreeSignature,
  serializeTreeSignature,
  deserializeTreeSignature,
} from '../src/treekey';

const hex = (u: Uint8Array) => Buffer.from(u).toString('hex');

describe('REGRESSION: deserializeTreeSignature MMR proof bytesRead offset', () => {
  it('serialize then deserialize round-trips a 3-level TreeSignature exactly', () => {
    const seed = sha3_256(new TextEncoder().encode('mmr-bytesread-regression'));
    const tk = new TreeKey(seed, 4, 3);
    const rootPubkey = tk.getPublicKey();
    const txDigest = sha3_256(new TextEncoder().encode('round-trip test data'));

    tk.setUses(0);
    const sig = tk.sign(txDigest);

    expect(sig.proofs.length).toBe(3);

    const serialized = serializeTreeSignature(sig);
    const deserialized = deserializeTreeSignature(serialized);

    expect(deserialized.proofs.length).toBe(3);

    for (let i = 0; i < 3; i++) {
      expect(hex(deserialized.proofs[i].leafPubkey)).toBe(hex(sig.proofs[i].leafPubkey));
      expect(hex(deserialized.proofs[i].signature)).toBe(hex(sig.proofs[i].signature));
      expect(deserialized.proofs[i].mmrProof.chunks.length).toBe(
        sig.proofs[i].mmrProof.chunks.length
      );
    }

    expect(verifyTreeSignature(rootPubkey, txDigest, deserialized)).toBe(true);
  });

  it('round-trip verifies at multiple tree positions without byte-offset drift', () => {
    const seed = sha3_256(new TextEncoder().encode('mmr-offset-drift-check'));
    const tk = new TreeKey(seed, 4, 3);
    const rootPubkey = tk.getPublicKey();

    const positions: [number, number, number][] = [
      [0, 0, 0],
      [1, 2, 3],
      [3, 3, 3],
    ];

    for (const [addressIndex, l1, l2] of positions) {
      const digest = sha3_256(
        new TextEncoder().encode(`drift-check-${addressIndex}-${l1}-${l2}`)
      );
      tk.setUses(addressIndex * 4 * 4 + l1 * 4 + l2);
      const sig = tk.sign(digest);

      const bytes = serializeTreeSignature(sig);
      const recovered = deserializeTreeSignature(bytes);

      expect(recovered.proofs.length).toBe(3);
      expect(verifyTreeSignature(rootPubkey, digest, recovered)).toBe(true);
    }
  });

  it('deserialized proof has correct chunk counts at each level', () => {
    const seed = sha3_256(new TextEncoder().encode('chunk-count-check'));
    const tk = new TreeKey(seed, 4, 3);
    const txDigest = sha3_256(new TextEncoder().encode('chunk count data'));

    tk.setUses(2 * 4 * 4 + 1 * 4 + 3);
    const sig = tk.sign(txDigest);

    const bytes = serializeTreeSignature(sig);
    const recovered = deserializeTreeSignature(bytes);

    for (let i = 0; i < 3; i++) {
      expect(recovered.proofs[i].mmrProof.chunks.length).toBe(
        sig.proofs[i].mmrProof.chunks.length
      );
      expect(recovered.proofs[i].mmrProof.chunks.length).toBeGreaterThan(0);
    }
  });
});
