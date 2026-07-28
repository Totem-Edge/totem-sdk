/**
 * Test suite for @totemsdk/root-identity — UnifiedIdentityWallet
 *
 * Covers: construction, address derivation, signing (incl. verifySignatureDetailed),
 *         watermarks, ownership proofs, verification, canonical ordering, and error paths.
 *
 * Tests share a single wallet instance wherever possible to avoid
 * regenerating expensive WOTS TreeKeys.
 */

import { UnifiedIdentityWallet, MAX_CHILD_COUNT } from '../src/UnifiedIdentityWallet';
import { verifySignatureDetailed } from '@totemsdk/core';
import type { OwnershipProof } from '../src/types';

// ─── Shared fixture (created once, reused across suites) ─────────────────────

const SEED = new Uint8Array([
  0xa1, 0xb2, 0xc3, 0xd4, 0xe5, 0xf6, 0xa1, 0xb2,
  0xc3, 0xd4, 0xe5, 0xf6, 0xa1, 0xb2, 0xc3, 0xd4,
  0xe5, 0xf6, 0xa1, 0xb2, 0xc3, 0xd4, 0xe5, 0xf6,
  0xa1, 0xb2, 0xc3, 0xd4, 0xe5, 0xf6, 0xa1, 0xb2,
]);

const sharedWallet = new UnifiedIdentityWallet(SEED, 10);
const sharedWallet5 = new UnifiedIdentityWallet(SEED, 5);

// ─── Constructor tests ───────────────────────────────────────────────────────

describe('UnifiedIdentityWallet — construction', () => {
  test('creates wallet from 32-byte seed', () => {
    expect(sharedWallet).toBeInstanceOf(UnifiedIdentityWallet);
  });

  test('accepts custom childCount', () => {
    expect(sharedWallet.getChildCount()).toBe(10);
  });

  test('default childCount is MAX_CHILD_COUNT (64)', () => {
    const w = new UnifiedIdentityWallet(SEED);
    expect(w.getChildCount()).toBe(MAX_CHILD_COUNT);
    expect(MAX_CHILD_COUNT).toBe(64);
  });

  test('rejects seed shorter than 32 bytes', () => {
    expect(() => new UnifiedIdentityWallet(new Uint8Array(16))).toThrow('32 bytes');
  });

  test('rejects childCount of 0', () => {
    expect(() => new UnifiedIdentityWallet(SEED, 0)).toThrow();
  });

  test('rejects childCount greater than 64', () => {
    expect(() => new UnifiedIdentityWallet(SEED, 65)).toThrow();
  });

  test('fromPhrase creates wallet from mnemonic', () => {
    const phrase = UnifiedIdentityWallet.generatePhrase();
    const w = UnifiedIdentityWallet.fromPhrase(phrase, 2);
    expect(w).toBeInstanceOf(UnifiedIdentityWallet);
  });

  test('validatePhrase returns true for generated phrase', () => {
    const phrase = UnifiedIdentityWallet.generatePhrase();
    expect(UnifiedIdentityWallet.validatePhrase(phrase)).toBe(true);
  });
});

// ─── Address derivation tests ────────────────────────────────────────────────

describe('UnifiedIdentityWallet — address derivation', () => {
  test('getRootAddress returns a non-empty string', () => {
    const addr = sharedWallet.getRootAddress();
    expect(typeof addr).toBe('string');
    expect(addr.length).toBeGreaterThan(10);
  });

  test('getRootPublicKey returns 64-char hex', () => {
    const pk = sharedWallet.getRootPublicKey();
    expect(pk).toMatch(/^[0-9a-f]{64}$/);
  });

  test('root address differs from child addresses (root is identity anchor, not a spend addr)', () => {
    expect(sharedWallet.getChildAddress(0)).not.toBe(sharedWallet.getRootAddress());
  });

  test('each child address is unique', () => {
    const addresses = new Set<string>();
    for (let i = 0; i < 5; i++) {
      addresses.add(sharedWallet.getChildAddress(i));
    }
    expect(addresses.size).toBe(5);
  });

  test('getAllAddresses length equals childCount + 1', () => {
    const all = sharedWallet5.getAllAddresses();
    expect(all).toHaveLength(6); // root + 5 children
  });

  test('getAllAddresses first entry equals getRootAddress', () => {
    const all = sharedWallet5.getAllAddresses();
    expect(all[0]).toBe(sharedWallet5.getRootAddress());
  });

  test('getAddressMap has correct shape', () => {
    const map = sharedWallet5.getAddressMap();
    expect(map.root).toBe(sharedWallet5.getRootAddress());
    expect(map.children).toHaveLength(5);
  });

  test('child addresses are deterministic across wallet instances', () => {
    const w2 = new UnifiedIdentityWallet(SEED, 10);
    expect(sharedWallet.getChildAddress(3)).toBe(w2.getChildAddress(3));
  });

  test('getChildAddress throws on out-of-range index', () => {
    expect(() => sharedWallet5.getChildAddress(5)).toThrow();
  });

  test('getChildPublicKey returns 64-char hex', () => {
    expect(sharedWallet.getChildPublicKey(0)).toMatch(/^[0-9a-f]{64}$/);
  });

  test('root public key differs from child public keys', () => {
    expect(sharedWallet.getRootPublicKey()).not.toBe(sharedWallet.getChildPublicKey(0));
  });

  test('address lookup is cached (second call returns same value)', () => {
    const a1 = sharedWallet.getChildAddress(1);
    const a2 = sharedWallet.getChildAddress(1);
    expect(a1).toBe(a2);
  });
});

// ─── Signing tests ───────────────────────────────────────────────────────────

describe('UnifiedIdentityWallet — signing', () => {
  const sigWallet = new UnifiedIdentityWallet(SEED, 5);

  test('signFromRoot returns WotsProof with correct shape', () => {
    const proof = sigWallet.signFromRoot('hello root');
    expect(proof.address).toBe(sigWallet.getRootAddress());
    expect(proof.publicKey).toBe(sigWallet.getRootPublicKey());
    expect(proof.message).toBe('hello root');
    expect(typeof proof.signature).toBe('string');
    expect(proof.signature.length).toBeGreaterThan(64);
  });

  test('signFromRoot proof is accepted by verifySignatureDetailed', () => {
    const w = new UnifiedIdentityWallet(SEED, 2);
    const proof = w.signFromRoot('verify me');
    const result = verifySignatureDetailed(
      proof.address,
      proof.message,
      proof.signature,
      proof.publicKey,
    );
    expect(result.valid).toBe(true);
  });

  test('signFromChild returns WotsProof with correct shape', () => {
    const proof = sigWallet.signFromChild(0, 'child message');
    expect(proof.address).toBe(sigWallet.getChildAddress(0));
    expect(proof.publicKey).toBe(sigWallet.getChildPublicKey(0));
    expect(proof.message).toBe('child message');
    expect(typeof proof.signature).toBe('string');
  });

  test('signFromChild proof is accepted by verifySignatureDetailed', () => {
    const w = new UnifiedIdentityWallet(SEED, 2);
    const proof = w.signFromChild(0, 'child verify me');
    const result = verifySignatureDetailed(
      proof.address,
      proof.message,
      proof.signature,
      proof.publicKey,
    );
    expect(result.valid).toBe(true);
  });

  test('signFromRoot proof rejected when verified against wrong address', () => {
    const w = new UnifiedIdentityWallet(SEED, 2);
    const proof = w.signFromRoot('wrong address test');
    const result = verifySignatureDetailed(
      w.getChildAddress(0),
      proof.message,
      proof.signature,
      proof.publicKey,
    );
    expect(result.valid).toBe(false);
  });

  test('signFromRoot increments rootUses', () => {
    const w = new UnifiedIdentityWallet(SEED, 2);
    expect(w.getRootUses()).toBe(0);
    w.signFromRoot('m1');
    expect(w.getRootUses()).toBe(1);
    w.signFromRoot('m2');
    expect(w.getRootUses()).toBe(2);
  });

  test('signFromChild increments only that child uses', () => {
    const w = new UnifiedIdentityWallet(SEED, 5);
    w.signFromChild(2, 'hi');
    expect(w.getChildUses(2)).toBe(1);
    expect(w.getChildUses(0)).toBe(0);
  });

  test('two sequential signatures from same key are different', () => {
    const w = new UnifiedIdentityWallet(SEED, 2);
    const p1 = w.signFromRoot('same message');
    const p2 = w.signFromRoot('same message');
    expect(p1.signature).not.toBe(p2.signature);
  });

  test('root and child sign independently without affecting each other', () => {
    const w = new UnifiedIdentityWallet(SEED, 2);
    w.signFromRoot('root signs');
    w.signFromChild(0, 'child signs');
    expect(w.getRootUses()).toBe(1);
    expect(w.getChildUses(0)).toBe(1);
  });

  test('signFromChild throws on negative index', () => {
    expect(() => sigWallet.signFromChild(-1, 'x')).toThrow();
  });
});

// ─── Watermark persistence tests ─────────────────────────────────────────────

describe('UnifiedIdentityWallet — watermarks', () => {
  test('setRootUses / getRootUses round-trip', () => {
    const w = new UnifiedIdentityWallet(SEED, 2);
    w.setRootUses(42);
    expect(w.getRootUses()).toBe(42);
  });

  test('setChildUses / getChildUses round-trip', () => {
    const w = new UnifiedIdentityWallet(SEED, 5);
    w.setChildUses(3, 100);
    expect(w.getChildUses(3)).toBe(100);
  });

  test('getMaxUsesPerSlot is 262144', () => {
    expect(sharedWallet.getMaxUsesPerSlot()).toBe(262144);
  });

  test('setRootUses rejects negative value', () => {
    expect(() => sharedWallet.setRootUses(-1)).toThrow();
  });
});

// ─── Ownership proof tests ───────────────────────────────────────────────────

describe('UnifiedIdentityWallet — proveOwnership / verifyOwnershipProof', () => {
  const ownWallet = new UnifiedIdentityWallet(SEED, 5);

  test('proveOwnership returns correct OwnershipProof shape', () => {
    const proof = ownWallet.proveOwnership([0, 1]);
    expect(proof.rootAddress).toBe(ownWallet.getRootAddress());
    expect(proof.rootPublicKey).toBe(ownWallet.getRootPublicKey());
    expect(proof.childAddresses).toHaveLength(2);
    expect(proof.childPublicKeys).toHaveLength(2);
    expect(typeof proof.timestamp).toBe('string');
    expect(typeof proof.rootProof.signature).toBe('string');
  });

  test('verifyOwnershipProof returns true for valid proof (single child)', () => {
    const proof = ownWallet.proveOwnership([0]);
    expect(UnifiedIdentityWallet.verifyOwnershipProof(proof)).toBe(true);
  });

  test('verifyOwnershipProof returns true for valid proof (multiple children)', () => {
    const proof = ownWallet.proveOwnership([1, 2]);
    expect(UnifiedIdentityWallet.verifyOwnershipProof(proof)).toBe(true);
  });

  test('proof is valid regardless of childIndices order (canonical sorting)', () => {
    const proofAscending = ownWallet.proveOwnership([0, 2]);
    const proofDescending = ownWallet.proveOwnership([2, 0]);
    expect(UnifiedIdentityWallet.verifyOwnershipProof(proofAscending)).toBe(true);
    expect(UnifiedIdentityWallet.verifyOwnershipProof(proofDescending)).toBe(true);
  });

  test('proof childAddresses match expected child addresses', () => {
    const proof = ownWallet.proveOwnership([3, 4]);
    expect(proof.childAddresses[0]).toBe(ownWallet.getChildAddress(3));
    expect(proof.childAddresses[1]).toBe(ownWallet.getChildAddress(4));
  });

  // ── Tamper detection ────────────────────────────────────────────────────────

  test('verifyOwnershipProof detects tampered rootAddress', () => {
    const proof = ownWallet.proveOwnership([0]);
    const tampered: OwnershipProof = { ...proof, rootAddress: ownWallet.getChildAddress(0) };
    expect(UnifiedIdentityWallet.verifyOwnershipProof(tampered)).toBe(false);
  });

  test('verifyOwnershipProof detects tampered rootPublicKey', () => {
    const proof = ownWallet.proveOwnership([0]);
    const tampered: OwnershipProof = {
      ...proof,
      rootPublicKey: ownWallet.getChildPublicKey(0),
    };
    expect(UnifiedIdentityWallet.verifyOwnershipProof(tampered)).toBe(false);
  });

  test('verifyOwnershipProof detects tampered signature', () => {
    const proof = ownWallet.proveOwnership([0]);
    const tampered: OwnershipProof = {
      ...proof,
      rootProof: { ...proof.rootProof, signature: proof.rootProof.signature.replace(/^.{4}/, 'dead') },
    };
    expect(UnifiedIdentityWallet.verifyOwnershipProof(tampered)).toBe(false);
  });

  test('verifyOwnershipProof detects tampered childPublicKey', () => {
    const proof = ownWallet.proveOwnership([0]);
    const tampered: OwnershipProof = {
      ...proof,
      childPublicKeys: [ownWallet.getRootPublicKey()],
    };
    expect(UnifiedIdentityWallet.verifyOwnershipProof(tampered)).toBe(false);
  });

  test('verifyOwnershipProof detects tampered childAddress (swapped to wrong address)', () => {
    const proof = ownWallet.proveOwnership([0]);
    const tampered: OwnershipProof = {
      ...proof,
      childAddresses: [ownWallet.getRootAddress()],
    };
    expect(UnifiedIdentityWallet.verifyOwnershipProof(tampered)).toBe(false);
  });

  test('verifyOwnershipProof rejects proof signed by a different root', () => {
    const seed2 = new Uint8Array(32).fill(0xab);
    const otherWallet = new UnifiedIdentityWallet(seed2, 3);

    const legitimateProof = ownWallet.proveOwnership([0]);
    const spoofed: OwnershipProof = {
      ...legitimateProof,
      rootAddress: otherWallet.getRootAddress(),
      rootPublicKey: otherWallet.getRootPublicKey(),
    };
    expect(UnifiedIdentityWallet.verifyOwnershipProof(spoofed)).toBe(false);
  });

  // ── Malformed input ─────────────────────────────────────────────────────────

  test('verifyOwnershipProof returns false for null input (never throws)', () => {
    expect(UnifiedIdentityWallet.verifyOwnershipProof(null as unknown as OwnershipProof)).toBe(false);
  });

  test('verifyOwnershipProof returns false for empty object (never throws)', () => {
    expect(UnifiedIdentityWallet.verifyOwnershipProof({} as unknown as OwnershipProof)).toBe(false);
  });

  test('verifyOwnershipProof returns false for proof with invalid hex in childPublicKeys (never throws)', () => {
    const proof = ownWallet.proveOwnership([0]);
    const tampered: OwnershipProof = {
      ...proof,
      childPublicKeys: ['not-valid-hex-at-all'],
    };
    expect(UnifiedIdentityWallet.verifyOwnershipProof(tampered)).toBe(false);
  });

  test('verifyOwnershipProof returns false for empty childAddresses', () => {
    const proof = ownWallet.proveOwnership([0]);
    const tampered: OwnershipProof = {
      ...proof,
      childAddresses: [],
      childPublicKeys: [],
    };
    expect(UnifiedIdentityWallet.verifyOwnershipProof(tampered)).toBe(false);
  });

  // ── Error paths ─────────────────────────────────────────────────────────────

  test('proveOwnership throws on empty childIndices (at least one required)', () => {
    expect(() => ownWallet.proveOwnership([])).toThrow();
  });

  test('proveOwnership throws on duplicate indices', () => {
    expect(() => ownWallet.proveOwnership([1, 1])).toThrow('Duplicate');
  });

  test('two wallets from different seeds produce different root addresses', () => {
    const seed2 = new Uint8Array(32).fill(0xff);
    const w2 = new UnifiedIdentityWallet(seed2, 2);
    expect(ownWallet.getRootAddress()).not.toBe(w2.getRootAddress());
  });
});
