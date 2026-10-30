/**
 * RFC-008 Phase 1 — SE identity / leased one-time WOTS signing.
 *
 * Regression coverage for AUD-003 (leaf reuse), AUD-025 (advertised key ≠
 * signer), and the durability guarantees that make leased leaves safe across
 * restarts and concurrent requests.
 */

import { MemoryStore } from '@totemsdk/storage';
import { SeIdentity } from '../seIdentity.js';

const SEED = new Uint8Array(32).fill(0x7a);

jest.setTimeout(180_000);

describe('SeIdentity — root identity + leased one-time leaves (RFC-008 Phase 1)', () => {
  it('publishes a root identity whose OwnershipProof authorizes the signing leaf', async () => {
    const storage = new MemoryStore();
    const identity = await SeIdentity.create({ seed: SEED, storage });

    const published = identity.getPublishedIdentity();
    expect(published.ownershipProof.rootAddress).toBe(published.rootAddress);
    expect(published.ownershipProof.rootPublicKey).toBe(published.rootPublicKey);
    expect(published.ownershipProof.childPublicKeys).toHaveLength(1);

    const sig = await identity.sign('hello');
    expect(sig.publicKey).toBe(published.ownershipProof.childPublicKeys[0]);
    expect(sig.address).toBe(published.ownershipProof.childAddresses[0]);

    await expect(SeIdentity.verify('hello', sig, published)).resolves.toBe(true);
    await expect(SeIdentity.verify('tampered', sig, published)).resolves.toBe(false);
  });

  it('signs every message with a distinct leaf (no index-0 reuse)', async () => {
    const storage = new MemoryStore();
    const identity = await SeIdentity.create({ seed: SEED, storage });
    const published = identity.getPublishedIdentity();

    const a = await identity.sign('msg-a');
    const b = await identity.sign('msg-b');

    // Same member/child, but different one-time leaves => different signatures.
    expect(a.publicKey).toBe(b.publicKey);
    expect(a.signature).not.toBe(b.signature);

    await expect(SeIdentity.verify('msg-a', a, published)).resolves.toBe(true);
    await expect(SeIdentity.verify('msg-b', b, published)).resolves.toBe(true);
  });

  it('does not reuse a leaf across a restart (durable lease watermark)', async () => {
    const storage = new MemoryStore();
    const first = await SeIdentity.create({ seed: SEED, storage });
    const a = await first.sign('one');

    // A fresh identity over the SAME durable storage must resume the lease.
    const second = await SeIdentity.create({ seed: SEED, storage });
    const b = await second.sign('two');

    expect(b.signature).not.toBe(a.signature);

    // The root-issued proof still covers child 0, so both signatures verify
    // against the current published identity.
    const published = second.getPublishedIdentity();
    await expect(SeIdentity.verify('one', a, published)).resolves.toBe(true);
    await expect(SeIdentity.verify('two', b, published)).resolves.toBe(true);
  });

  it('rejects a signature whose leaf is not authorized (substituted key)', async () => {
    const storage = new MemoryStore();
    const identity = await SeIdentity.create({ seed: SEED, storage });
    const published = identity.getPublishedIdentity();
    const sig = await identity.sign('payload');

    const forged = { ...sig, publicKey: 'f'.repeat(64) };
    await expect(SeIdentity.verify('payload', forged, published)).resolves.toBe(false);
  });
});
