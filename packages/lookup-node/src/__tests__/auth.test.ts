/**
 * RFC-032 adversarial tests: WOTS auth verification + replay rejection.
 *
 * Covers: valid real WOTS signature accepted; expired rejected; forged/unknown
 * identity rejected; replayed nonce rejected; lower nonce rejected.
 */

import { createPerAddressTreeKey, serializeTreeSignature, bytesToHex } from '@totemsdk/core';
import { authDigest, signMessage } from '@totemsdk/lookup-protocol';
import type { GetCoinsMessage, LookupMessage } from '@totemsdk/lookup-protocol';
import { verifyAuthEnvelope, ReplayGuard } from '../auth-verify.js';

// A WOTS/TreeKey identity for tests.
function makeIdentity(seedByte: number) {
  const seed = new Uint8Array(32).fill(seedByte);
  const treeKey = createPerAddressTreeKey(seed, 0);
  const pk = bytesToHex(treeKey.getPublicKey()).toLowerCase();
  return { treeKey, pk };
}

const MSG: GetCoinsMessage = { type: 'GET_COINS', version: 2, payload: { address: 'Mx1' } };

describe('verifyAuthEnvelope — real WOTS signatures', () => {
  it('accepts a valid WOTS-signed message', async () => {
    const id = makeIdentity(0x11);
    const expiresAt = Date.now() + 60_000;
    const digest = authDigest(MSG, 0, expiresAt);
    const sigBytes = serializeTreeSignature(id.treeKey.sign(digest));

    const msg = {
      ...MSG,
      auth: {
        rootPublicKey: id.pk,
        signature: bytesToHex(sigBytes).toLowerCase(),
        nonce: 0,
        expiresAt,
      },
    } as LookupMessage;

    const result = await verifyAuthEnvelope(msg);
    expect(result.valid).toBe(true);
    expect(result.publicKeyHex).toBe(id.pk);
    expect(result.nonce).toBe(0);

    const guard = new ReplayGuard();
    expect(guard.claim(result.publicKeyHex!, result.nonce!)).toBe(true);
  });

  it('rejects an expired envelope', async () => {
    const id = makeIdentity(0x22);
    const expiresAt = 1000;
    const digest = authDigest(MSG, 0, expiresAt);
    const sigBytes = serializeTreeSignature(id.treeKey.sign(digest));
    const msg = {
      ...MSG,
      auth: { rootPublicKey: id.pk, signature: bytesToHex(sigBytes).toLowerCase(), nonce: 0, expiresAt },
    } as LookupMessage;
    const result = await verifyAuthEnvelope(msg, 2000);
    expect(result.valid).toBe(false);
  });

  it('rejects a signature from a different identity (forged rootPublicKey)', async () => {
    const signer = makeIdentity(0x33);
    const claimed = makeIdentity(0x44);
    const expiresAt = Date.now() + 60_000;
    const digest = authDigest(MSG, 0, expiresAt);
    const sigBytes = serializeTreeSignature(signer.treeKey.sign(digest));
    const msg = {
      ...MSG,
      auth: {
        rootPublicKey: claimed.pk, // mismatched with signer
        signature: bytesToHex(sigBytes).toLowerCase(),
        nonce: 0,
        expiresAt,
      },
    } as LookupMessage;
    const result = await verifyAuthEnvelope(msg);
    expect(result.valid).toBe(false);
  });

  it('rejects a tampered payload (signature no longer matches digest)', async () => {
    const id = makeIdentity(0x55);
    const expiresAt = Date.now() + 60_000;
    const digest = authDigest(MSG, 0, expiresAt);
    const sigBytes = serializeTreeSignature(id.treeKey.sign(digest));
    const tampered = {
      type: 'GET_COINS',
      version: 2,
      payload: { address: 'MxEVIL' }, // changed after signing
      auth: { rootPublicKey: id.pk, signature: bytesToHex(sigBytes).toLowerCase(), nonce: 0, expiresAt },
    } as LookupMessage;
    const result = await verifyAuthEnvelope(tampered);
    expect(result.valid).toBe(false);
  });
});

describe('ReplayGuard — nonce monotonicity', () => {
  it('rejects a repeated nonce (verbatim replay)', () => {
    const g = new ReplayGuard();
    expect(g.claim('pk', 5)).toBe(true);
    expect(g.claim('pk', 5)).toBe(false);
  });

  it('rejects a lower nonce (reorder/reuse)', () => {
    const g = new ReplayGuard();
    expect(g.claim('pk', 5)).toBe(true);
    expect(g.claim('pk', 4)).toBe(false);
  });

  it('accepts a strictly increasing nonce', () => {
    const g = new ReplayGuard();
    expect(g.claim('pk', 1)).toBe(true);
    expect(g.claim('pk', 2)).toBe(true);
    expect(g.highWatermark('pk')).toBe(2);
  });

  it('tracks identities independently', () => {
    const g = new ReplayGuard();
    expect(g.claim('alice', 9)).toBe(true);
    expect(g.claim('bob', 1)).toBe(true);
    expect(g.claim('alice', 9)).toBe(false);
  });
});

describe('signMessage + verifyAuthEnvelope round-trip', () => {
  it('a protocol-signed message verifies with the node', async () => {
    const id = makeIdentity(0x66);
    const sign = async (digest: Uint8Array) => serializeTreeSignature(id.treeKey.sign(digest));
    const signed = await signMessage<LookupMessage>(MSG, sign, id.pk, {
      nonce: id.treeKey.getUses(),
      expiresAt: Date.now() + 60_000,
    });
    const result = await verifyAuthEnvelope(signed);
    expect(result.valid).toBe(true);
  });
});
