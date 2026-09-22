/**
 * Durable StateChain store tests (RFC-007 Phase 4): reopen + corruption,
 * concurrent-safe revision-CAS persistence, recovery-without-SE assertions,
 * and the no-silent-downgrade guard — mirroring the Phase 3 durable-store
 * suite patterns.
 *
 * Owner/SE identity in the fixtures is real TreeKey (RFC-009): `verifyStateChain`
 * runs its real root-bound verification, so no mock verifier overrides exist.
 */

import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { sha3_256, hex } from '@totemsdk/core';
import { MemoryStore } from '@totemsdk/storage';
import { FileStore } from '@totemsdk/storage/fs';
import type { StorageAdapter } from '@totemsdk/core';
import { StorageError } from '@totemsdk/storage/errors';

import { createDurableStateChainStore, type DurableStateChainStoreOptions, type DurableStateChainStore } from '../durable-store.js';
import { createStateChain, transferOwnership, claimOwnership, reclaimAbandoned } from '../index.js';
import type { StatechainOwner, StateChain } from '../index.js';
import { attachSe, makeOwner, testSE } from './tree-fixtures';

const VOLATILE = { requireAckMode: 'volatile' as const };

// ─── Fixture plumbing (mirrors statechain.test.ts) ────────────────────────

function fakePkd(label: string): string {
  return hex(sha3_256(new TextEncoder().encode(label)));
}

const SE = testSE();

const COIN_ID = '0xaabbcc0011223344556677889900aabb00112233445566778899001122334455';
const TOKEN_ID = '0x00';
const AMOUNT = 1_000_000n;
const SE_ROOT = SE.rootPublicKey;
const ALICE = (): StatechainOwner =>
  makeOwner('alice', { address: fakePkd('addr:alice').padStart(64, '0'), tokenId: TOKEN_ID, amount: AMOUNT });

async function makeChain(partyId = 'alice'): Promise<StateChain> {
  const chain = await createStateChain(
    COIN_ID,
    makeOwner(partyId, { address: fakePkd('addr').padStart(64, '0'), tokenId: TOKEN_ID, amount: AMOUNT }),
    SE_ROOT,
    { seClient: SE.client() },
  );
  return attachSe(chain, SE);
}

function durableOptions(extra?: Partial<DurableStateChainStoreOptions>): DurableStateChainStoreOptions {
  return { ...VOLATILE, ...extra };
}

function durable(adapter: StorageAdapter, extra?: Partial<DurableStateChainStoreOptions>): DurableStateChainStore {
  return createDurableStateChainStore(adapter, durableOptions(extra));
}

describe('createDurableStateChainStore — construction guards', () => {
  it('rejects an adapter that does not declare capabilities (no silent downgrade)', () => {
    const plain = {
      async get() { return null; },
      async set() {},
      async remove() { return true; },
      async keys() { return []; },
      async has() { return false; },
      async clear() {},
    } as unknown as StorageAdapter;
    expect(() => createDurableStateChainStore(plain, { requireAckMode: 'volatile' })).toThrow(/capability-declaring/);
  });

  it('rejects a non-CAS adapter at construction', () => {
    const noCas = { ...new MemoryStore().capabilities };
    const adapter = {
      capabilities: noCas,
      async get() { return null; },
      async set() {},
      async remove() { return true; },
      async keys() { return []; },
      async has() { return false; },
      async clear() {},
    } as unknown as StorageAdapter;
    expect(() => createDurableStateChainStore(adapter, { requireAckMode: 'volatile' })).toThrow(/CAS-capable/);
  });

  it('rejects a low-durability adapter when durable ack is required (no silent downgrade)', () => {
    const store = new MemoryStore();
    expect(() => createDurableStateChainStore(store, {})).toThrow(/acknowledges "volatile"/);
  });
});

describe('createDurableStateChainStore — persistence', () => {
  it('save → get round-trip preserves the pre-signed reclaimTx', async () => {
    const store = durable(new MemoryStore());
    const chain = await makeChain();

    await store.save(chain);

    const loaded = await store.get(chain.chainId);
    expect(loaded?.chainId).toBe(chain.chainId);
    expect(loaded?.reclaimTx).toBe(chain.reclaimTx);
    expect(loaded?.reclaimTx.length).toBeGreaterThan(100);
    expect(loaded?.reclaimAddress).toBe(chain.reclaimAddress);
    expect(loaded?.amount).toBe(AMOUNT);
  });

  it('lists multiple chains and removes one', async () => {
    const store = durable(new MemoryStore());
    const a = await makeChain('alice');
    const b = await makeChain('bob');

    await store.save(a);
    await store.save(b);

    const ids = (await store.list()).map((c) => c.chainId).sort();
    expect(ids).toEqual([a.chainId, b.chainId].sort());

    expect(await store.remove(a.chainId)).toBe(true);
    expect(await store.remove('no-such-id')).toBe(false);
    expect((await store.list()).map((c) => c.chainId)).toEqual([b.chainId]);
  });

  it('updates in place and bumps the revision (revision-CAS)', async () => {
    const store = durable(new MemoryStore());
    expect(await store.getRevision()).toBe(0);
    expect(await store.hasState()).toBe(false);

    const chain = await makeChain();
    await store.save(chain);
    expect(await store.hasState()).toBe(true);
    expect(await store.getRevision()).toBe(1);

    // Simulate a transfer hop on the same chain (status + reclaimTx change).
    const updated: StateChain = { ...chain, status: 'claiming', createdAt: chain.createdAt + 1 };
    await store.save(updated);

    const loaded = await store.get(chain.chainId);
    expect(loaded?.status).toBe('claiming');
    expect(await store.getRevision()).toBe(2);
    expect((await store.getSnapshot()).chains[chain.chainId].createdAt).toBe(chain.createdAt + 1);
  });

  it('reopens from a durable file-backed store (simulated restart)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'totem-statechain-'));
    const chain = await makeChain();

    {
      const first = durable(new FileStore(dir));
      await first.save(chain);
    }

    {
      const restarted = durable(new FileStore(dir));
      const loaded = await restarted.get(chain.chainId);
      expect(loaded?.chainId).toBe(chain.chainId);
      expect(loaded?.reclaimTx).toBe(chain.reclaimTx);
      expect(loaded?.amount).toBe(AMOUNT);
      expect(await restarted.getRevision()).toBe(1);
    }
  });
});

describe('createDurableStateChainStore — recovery-without-SE report', () => {
  it('a persisted fresh chain is recoverable without SE cooperation', async () => {
    const se = SE.client();
    const store = durable(new MemoryStore());
    const chain = attachSe(await createStateChain(COIN_ID, ALICE(), SE_ROOT, { seClient: se }), SE);
    await store.save(chain);

    // SE refuses to co-operate — cooperative claim fails…
    await expect(claimOwnership(chain, { seClient: { blindSign: async () => { throw new Error('SE offline'); }, revokeKey: async () => {}, isRevoked: async () => false } }))
      .rejects.toThrow('SE offline');

    // …but the caller's stored reclaimTx works without any SE interaction.
    const recovered = await reclaimAbandoned(chain, { evidence: 'SE refused' });
    expect(recovered.txHex).toBe(chain.reclaimTx);

    const report = await store.getRecoveryReport(chain.chainId);
    expect(report.hasReclaimTx).toBe(true);
    expect(report.ownerRecoveryMaterialPresent).toBe(true);
    expect(report.verifies).toBe(true);
    expect(report.recoverableWithoutSE).toBe(true);
  });

  it('returns a non-recoverable report for an unknown chain', async () => {
    const store = durable(new MemoryStore());
    const report = await store.getRecoveryReport('missing');
    expect(report.recoverableWithoutSE).toBe(false);
    expect(report.hasReclaimTx).toBe(false);
    expect(report.reason).toContain('no persisted statechain');
  });

  it('verifyRecoverability sweeps every persisted chain', async () => {
    const store = durable(new MemoryStore());
    await store.save(await makeChain('alice'));
    await store.save(await makeChain('bob'));

    const sweep = await store.verifyRecoverability();
    expect(sweep).toHaveLength(2);
    for (const { report } of sweep) {
      expect(report.recoverableWithoutSE).toBe(true);
    }
  });
});

describe('createDurableStateChainStore — corruption is surfaced, never absence', () => {
  it('refuses a snapshot holding unsupported state (never silently reinitialised)', async () => {
    const raw = new MemoryStore();
    const store = durable(raw);
    await store.save(await makeChain());

    // Overwrite the snapshot envelope with a structurally invalid record.
    await raw.set('totem_statechain:v1:snapshot', { version: 999, revision: 1, state: { chains: {} }, savedAt: 1 });

    const restarted = durable(raw);
    await expect(restarted.list()).rejects.toThrow(/version 999 unsupported/);
    // The corrupt record must NOT be clobbered by a fresh default.
    expect(await raw.has('totem_statechain:v1:snapshot')).toBe(true);
  });

  it('surfaces a corrupt chain record instead of treating it as absent', async () => {
    const raw = new MemoryStore();
    const store = durable(raw);
    const chain = await makeChain();
    await store.save(chain);

    // A chain stripped of its recovery material fails strict validation.
    const stripped = { ...chain, reclaimTx: '' };
    await raw.set('totem_statechain:v1:snapshot', {
      version: 1,
      revision: 2,
      state: { chains: { [chain.chainId]: stripped } },
      savedAt: 2,
    });

    await expect(store.get(chain.chainId)).rejects.toThrow(/no reclaimTx/);
    await expect(store.list()).rejects.toThrow(StorageError);
  });

  it('refuses to persist a chain that fails verification', async () => {
    const store = durable(new MemoryStore());
    const chain = await makeChain();
    // Give the chain a transfer hop so currentOwner is bound to history.
    const transferred = await transferOwnership(chain, makeOwner('bob'), SE.client());
    await store.save(transferred);

    const tampered: StateChain = {
      ...transferred,
      currentOwner: { ...transferred.currentOwner, partyId: 'malice' },
    };

    await expect(store.save(tampered)).rejects.toThrow(/write-failed|verification|currentOwner/);
  });
});

describe('createDurableStateChainStore — disk corruption (FileStore)', () => {
  it('raw garbage on disk raises corrupt, and load is not collapsed into not-found', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'totem-statechain-disk-'));
    const store = durable(new FileStore(dir));
    await store.save(await makeChain());

    const raw = new FileStore(dir);
    await raw.set('totem_statechain:v1:snapshot', { not: 'an envelope any consumer should accept' });
    await expect(store.get('irrelevant')).rejects.toThrow(StorageError);
    await expect(store.get('irrelevant')).rejects.toThrow(/state version|corrupt|validation/);
  });

  it('refuses an on-disk chain snapshot without a bigint amount (round-trip guard)', async () => {
    const raw = new MemoryStore();
    const store = durable(raw);
    const chain = await makeChain();
    await store.save(chain);

    await raw.set('totem_statechain:v1:snapshot', {
      version: 1,
      revision: 2,
      state: { chains: { [chain.chainId]: { ...chain, amount: '1000000' } } },
      savedAt: 2,
    });

    await expect(store.list()).rejects.toThrow(StorageError);
    await expect(store.list()).rejects.toThrow(/did not round-trip/);
  });
});
