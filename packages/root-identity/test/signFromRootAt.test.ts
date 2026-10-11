/**
 * RFC-037 Amendment A §8 — explicit root-leaf allocation.
 *
 * `signFromRootAt` / `proveOwnership({ rootUseIndex })` let a host allocate the
 * one-time root leaf itself (e.g. from a WOTS lease) so a fresh wallet instance
 * never re-signs root leaf 0.
 */

import { UnifiedIdentityWallet } from '../src/UnifiedIdentityWallet.js';

const seed = new Uint8Array(32).fill(21);

describe('UnifiedIdentityWallet — explicit root use index', () => {
  it('signs at the requested leaf and advances the cursor', () => {
    const w = new UnifiedIdentityWallet(seed, 8);
    expect(w.getRootUses()).toBe(0);
    w.signFromRootAt('hello', 7);
    expect(w.getRootUses()).toBe(8);
  });

  it('proves ownership at an explicit root leaf index', () => {
    const w = new UnifiedIdentityWallet(seed, 8);
    const proof = w.proveOwnership([0, 1], { rootUseIndex: 5 });
    expect(UnifiedIdentityWallet.verifyOwnershipProof(proof)).toBe(true);
    expect(w.getRootUses()).toBe(6);
  });

  it('two proofs at different explicit indices both verify (no reuse)', () => {
    const w1 = new UnifiedIdentityWallet(seed, 8);
    const p1 = w1.proveOwnership([0], { rootUseIndex: 0 });
    const w2 = new UnifiedIdentityWallet(seed, 8);
    const p2 = w2.proveOwnership([0], { rootUseIndex: 1 });
    expect(p1.rootProof.signature).not.toBe(p2.rootProof.signature);
    expect(UnifiedIdentityWallet.verifyOwnershipProof(p1)).toBe(true);
    expect(UnifiedIdentityWallet.verifyOwnershipProof(p2)).toBe(true);
  });

  it('rejects invalid indices', () => {
    const w = new UnifiedIdentityWallet(seed, 8);
    expect(() => w.signFromRootAt('x', -1)).toThrow(/non-negative integer/);
    expect(() => w.signFromRootAt('x', 1.5)).toThrow(/non-negative integer/);
    expect(() => w.signFromRootAt('x', w.getRootTreeKey().getMaxUses())).toThrow(/exceeds capacity/);
  });

  it('does not lower the cursor when signing at an earlier explicit index', () => {
    const w = new UnifiedIdentityWallet(seed, 8);
    w.signFromRootAt('a', 10);
    w.signFromRootAt('b', 3);
    expect(w.getRootUses()).toBe(11);
  });
});
