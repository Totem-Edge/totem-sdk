/**
 * RFC-037 Phase 2 — wallet channel-signing bridge.
 *
 * The bridge binds a unified WOTS TreeKey to Omnia's ChannelSigner: the
 * advertised publicKeyDigest is the tree-root pubkey and signatures are
 * serialized TreeSignatures that omnia's verifyChannelSignature accepts.
 */

import { createUnifiedChildTreeKey } from '@totemsdk/core';
import { verifyChannelSignature } from '@totemsdk/omnia';
import type { SigningIndices } from '@totemsdk/wots-lease';
import { createWalletChannelSigningMaterial } from '../signer.js';

function digestOf(seedByte: number): Uint8Array {
  const d = new Uint8Array(32);
  for (let i = 0; i < 32; i++) d[i] = (seedByte + i) & 0xff;
  return d;
}

const indices = (l1: number, l2: number): SigningIndices =>
  ({ addressIndex: 0, l1, l2 }) as SigningIndices;

describe('createWalletChannelSigningMaterial (RFC-037 Phase 2)', () => {
  const treeKey = createUnifiedChildTreeKey(new Uint8Array(32).fill(5), 0);
  const { signer, participant } = createWalletChannelSigningMaterial(treeKey, { addressIndex: 0 });

  it('advertises the tree-root pubkey as the participant digest', () => {
    expect(signer.publicKeyDigest).toBe(participant.publicKeyDigest);
    expect(participant.publicKeyDigest).toMatch(/^0x[0-9a-f]{64}$/);
    expect(participant.addressIndex).toBe(0);
    expect(participant.partyId).toBe(participant.publicKeyDigest);
  });

  it('produces a signature omnia verifies against the participant digest', async () => {
    const digest = digestOf(1);
    const sig = await signer.sign(digest, indices(0, 0));
    expect(verifyChannelSignature(sig, digest, participant.publicKeyDigest)).toBe(true);
  });

  it('honours the reserved leaf index', async () => {
    const digest = digestOf(2);
    const sig = await signer.sign(digest, indices(0, 3));
    expect(verifyChannelSignature(sig, digest, participant.publicKeyDigest)).toBe(true);
  });

  it('rejects a signature over a different digest', async () => {
    const sig = await signer.sign(digestOf(3), indices(0, 1));
    expect(verifyChannelSignature(sig, digestOf(4), participant.publicKeyDigest)).toBe(false);
  });

  it('lets the caller override partyId and settlementAddress', () => {
    const m = createWalletChannelSigningMaterial(treeKey, {
      addressIndex: 2,
      partyId: 'alice',
      settlementAddress: '0x' + 'ab'.repeat(32),
    });
    expect(m.participant.partyId).toBe('alice');
    expect(m.participant.addressIndex).toBe(2);
    expect(m.participant.settlementAddress).toBe('0x' + 'ab'.repeat(32));
  });
});
