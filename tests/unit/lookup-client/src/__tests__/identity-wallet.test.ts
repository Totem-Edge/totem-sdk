/**
 * RFC-032 §9 Q1: the lookup identity can be the @totemsdk/root-identity wallet.
 *
 * Verifies that signing from the wallet-backed identity produces WOTS signatures
 * verifiable against the wallet's root public key, and that the wallet's
 * forward-only watermark advances (so no WOTS leaf is reused).
 */

import { sha3_256 } from '@totemsdk/core';
import { UnifiedIdentityWallet } from '@totemsdk/root-identity';
import { LookupIdentity, verifyIdentitySignature } from '../identity.js';

jest.setTimeout(60_000);

const SEED = new Uint8Array(32).fill(0x24);

describe('LookupIdentity.fromWallet (root-identity wiring)', () => {
  it('derives the identity from the wallet root key', () => {
    const wallet = new UnifiedIdentityWallet(SEED);
    const identity = LookupIdentity.fromWallet(wallet);
    expect(identity.rootPublicKey).toBe(wallet.getRootPublicKey().toLowerCase());
  });

  it('signs verifiably against the wallet root public key', () => {
    const wallet = new UnifiedIdentityWallet(SEED);
    const identity = LookupIdentity.fromWallet(wallet);
    const digest = sha3_256(new TextEncoder().encode('lookup-auth'));
    const { signature, nonce } = identity.sign(digest);
    expect(nonce).toBe(0);
    expect(verifyIdentitySignature(identity.rootPublicKey, digest, Buffer.from(signature).toString('hex'))).toBe(true);
  });

  it('advances the wallet watermark so a fresh leaf is used each time', () => {
    const wallet = new UnifiedIdentityWallet(SEED);
    const identity = LookupIdentity.fromWallet(wallet);
    expect(wallet.getRootUses()).toBe(0);

    identity.sign(sha3_256(new TextEncoder().encode('m1')));
    expect(wallet.getRootUses()).toBe(1);
    identity.sign(sha3_256(new TextEncoder().encode('m2')));
    expect(identity.uses).toBe(2);
    expect(wallet.getRootUses()).toBe(2);
  });

  it('restores the watermark forward-only across sessions', () => {
    const wallet1 = new UnifiedIdentityWallet(SEED);
    const id1 = LookupIdentity.fromWallet(wallet1);
    id1.sign(sha3_256(new TextEncoder().encode('m1')));
    id1.sign(sha3_256(new TextEncoder().encode('m2')));
    const state = wallet1.getWatermarkState();

    // New session: restore and continue from the persisted cursor.
    const wallet2 = new UnifiedIdentityWallet(SEED);
    wallet2.restoreWatermarkState(state);
    const id2 = LookupIdentity.fromWallet(wallet2);
    expect(id2.uses).toBe(2);
    const { nonce } = id2.sign(sha3_256(new TextEncoder().encode('m3')));
    expect(nonce).toBe(2);
  });

  it('supports a child slot', () => {
    const wallet = new UnifiedIdentityWallet(SEED);
    const identity = LookupIdentity.fromWallet(wallet, { slot: 3 });
    expect(identity.rootPublicKey).toBe(wallet.getChildPublicKey(3).toLowerCase());
    identity.sign(sha3_256(new TextEncoder().encode('x')));
    expect(wallet.getChildUses(3)).toBe(1);
  });
});
