/**
 * RFC-037 — unified WOTS channel signatures.
 *
 * The wallet signs channel digests with its unified hierarchical `TreeKey`
 * (serialized TreeSignature); the legacy flat `wotsSign` scheme is still
 * accepted during the migration. The advertised `publicKeyDigest` selects the
 * scheme: a tree root only verifies the hierarchical path, a flat leaf pubkey
 * only verifies the flat path.
 */

import {
  bytesToHex,
  createUnifiedChildTreeKey,
  serializeTreeSignature,
  wotsKeypairFromSeed,
  wotsSign,
} from '@totemsdk/core';
import { verifyChannelSignature, FLAT_WOTS_SIGNATURE_LENGTH } from '../wots.js';

function digestOf(seedByte: number): Uint8Array {
  const d = new Uint8Array(32);
  for (let i = 0; i < 32; i++) d[i] = (seedByte + i) & 0xff;
  return d;
}

describe('verifyChannelSignature — hierarchical (wallet TreeKey) scheme', () => {
  const baseSeed = new Uint8Array(32).fill(7);
  const treeKey = createUnifiedChildTreeKey(baseSeed, 0);
  const rootPubkeyHex = bytesToHex(treeKey.getPublicKey());
  const digest = digestOf(1);

  it('verifies a serialized tree signature against the tree-root pubkey', () => {
    treeKey.setUses(0);
    const sig = serializeTreeSignature(treeKey.sign(digest)) as Uint8Array;
    expect(verifyChannelSignature(sig, digest, rootPubkeyHex)).toBe(true);
  });

  it('rejects a signature over a different digest', () => {
    treeKey.setUses(1);
    const sig = serializeTreeSignature(treeKey.sign(digest)) as Uint8Array;
    expect(verifyChannelSignature(sig, digestOf(2), rootPubkeyHex)).toBe(false);
  });

  it('rejects a malformed / non-TreeSignature blob', () => {
    expect(verifyChannelSignature(new Uint8Array([1, 2, 3]), digest, rootPubkeyHex)).toBe(false);
    expect(verifyChannelSignature(new Uint8Array(0), digest, rootPubkeyHex)).toBe(false);
  });

  it('rejects a non-32-byte public key digest', () => {
    treeKey.setUses(2);
    const sig = serializeTreeSignature(treeKey.sign(digest)) as Uint8Array;
    expect(verifyChannelSignature(sig, digest, 'abcd')).toBe(false);
  });
});

describe('verifyChannelSignature — legacy flat scheme (migration window)', () => {
  const seed = new Uint8Array(32).fill(9);
  const kp = wotsKeypairFromSeed(seed, 0);
  const flatPubkeyHex = bytesToHex(kp.pk);
  const digest = digestOf(3);

  it('verifies a flat wotsSign signature against the flat leaf pubkey', () => {
    const flatSig = wotsSign(seed, 0, digest);
    expect(flatSig.length).toBe(FLAT_WOTS_SIGNATURE_LENGTH);
    expect(verifyChannelSignature(flatSig, digest, flatPubkeyHex)).toBe(true);
  });

  it('rejects a flat signature against a tree-root pubkey', () => {
    const treeKey = createUnifiedChildTreeKey(seed, 0);
    const treeRootHex = bytesToHex(treeKey.getPublicKey());
    const flatSig = wotsSign(seed, 0, digest);
    expect(verifyChannelSignature(flatSig, digest, treeRootHex)).toBe(false);
  });
});
