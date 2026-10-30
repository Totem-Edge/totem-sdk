/**
 * Durable factory signing-state store tests (RFC-007 G9).
 *
 * Recovery ownership: pending commitments, partial-signature counts, and the
 * state log survive a host restart with **no partial-funding loss**. The
 * crash-window gate is: kill the host mid-signing-round (some parties have
 * signed `pendingCommitment`, others have not), restart over the same adapter,
 * and the reopened registry must resume with every collected signature intact
 * and the funding allocations unchanged.
 *
 * Corrupt or version-mismatched records are surfaced (`corrupt`),
 * never reinitialised as absence.
 */

import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { MemoryStore } from '@totemsdk/storage';
import { FileStore } from '@totemsdk/storage/fs';
import { StorageError } from '@totemsdk/storage/errors';
import { createDurableFactoryStore } from '../durable-factory-store.js';
import { createFactory, acceptFactory, enforceConservation } from '../factory.js';
import type { ChannelFactory, FactoryParticipant, WotsLeaseBundle } from '../types.js';

const VOLATILE = { requireAckMode: 'volatile' as const };

// ─── Mock helpers (mirror factory.test.ts) ────────────────────────────────────

function makeMockBundle(pkd: string): WotsLeaseBundle {
  return {
    leaseProvider: {
      reserveKeyUse: jest.fn(async () => ({
        reservationId: `res-${Math.random()}`,
        indices: { addressIndex: 0, l1: 0, l2: 0 },
        expiresAt: Date.now() + 60_000,
      })),
      commitKeyUse:    jest.fn(async () => {}),
      burnReservation: jest.fn(async () => {}),
    },
    signer: { publicKeyDigest: pkd, sign: jest.fn(async () => new Uint8Array(64).fill(0x42)) },
    verify: () => true,
  };
}

const ALICE: FactoryParticipant = {
  partyId: 'alice', publicKeyDigest: '0x' + 'aa'.repeat(32), addressIndex: 0,
  contributionAmount: 1000n, settlementAddress: '0xALICE_SETTLE',
};
const BOB: FactoryParticipant = {
  partyId: 'bob', publicKeyDigest: '0x' + 'bb'.repeat(32), addressIndex: 1,
  contributionAmount: 500n, settlementAddress: '0xBOB_SETTLE',
};
const CAROL: FactoryParticipant = {
  partyId: 'carol', publicKeyDigest: '0x' + 'cc'.repeat(32), addressIndex: 2,
  contributionAmount: 500n, settlementAddress: '0xCAROL_SETTLE',
};

/** Open a 3-party factory with exactly 2 of 3 signatures collected (mid-round). */
async function factoryMidSigningRound(): Promise<ChannelFactory> {
  const bundles: Record<string, WotsLeaseBundle> = {
    alice: makeMockBundle(ALICE.publicKeyDigest),
    bob:   makeMockBundle(BOB.publicKeyDigest),
  };
  let f = await createFactory([ALICE, BOB, CAROL], '0x00', bundles.alice);
  f = await acceptFactory(f, bundles.bob);
  // carol's signature is intentionally NOT collected — the crash hits here.
  expect(f.status).toBe('opening');
  expect(Object.keys(f.pendingSignatures)).toEqual(['alice', 'bob']);
  return f;
}

describe('createDurableFactoryStore', () => {
  describe('MemoryStore (volatile) — parity', () => {
    it('persists and retrieves a factory', async () => {
      const store = createDurableFactoryStore(new MemoryStore(), VOLATILE);
      const factory = await factoryMidSigningRound();
      await store.saveFactory(factory);

      const reopened = await store.getFactory(factory.factoryId);
      expect(reopened).toBeDefined();
      expect(reopened?.factoryId).toBe(factory.factoryId);
      expect(reopened?.totalValue).toBe(2000n);
      // Partial signatures survive as byte arrays.
      expect(reopened?.pendingSignatures).toHaveProperty('alice');
      expect(reopened?.pendingSignatures.alice).toEqual(new Uint8Array(64).fill(0x42));
    });

    it('lists all factories', async () => {
      const store = createDurableFactoryStore(new MemoryStore(), VOLATILE);
      const f = await createFactory([ALICE, BOB], '0x00', makeMockBundle(ALICE.publicKeyDigest));
      const f2 = await createFactory([BOB, ALICE], '0x00', makeMockBundle(BOB.publicKeyDigest));
      await store.saveFactory(f);
      await store.saveFactory(f2);
      expect(await store.listFactories()).toHaveLength(2);
    });

    it('preserves bigint amounts and Uint8Array signatures through the codec', async () => {
      const adapter = new MemoryStore();
      const store = createDurableFactoryStore(adapter, VOLATILE);
      const factory = await factoryMidSigningRound();
      await store.saveFactory(factory);

      const raw = await adapter.get<{ state: { factories: Record<string, ChannelFactory> } }>(
        'totem_omnia_factory:v1:snapshot',
      );
      const stored = raw?.state.factories[factory.factoryId];
      expect(stored?.totalValue).toBe(2000n);
      expect(stored?.participants[0].contributionAmount).toBe(1000n);
      expect(stored?.pendingSignatures.alice).toBeInstanceOf(Uint8Array);
    });
  });

  describe('FileStore (durable) — crash-window and corruption', () => {
    let dir: string;

    beforeEach(async () => {
      dir = await fs.mkdtemp(join(tmpdir(), 'totem-omnia-factory-'));
    });

    afterEach(async () => {
      await fs.rm(dir, { recursive: true, force: true });
    });

    it('resumes a mid-signing-round factory after a restart with no partial-funding loss', async () => {
      // ── Round 1: proposer + one counterparty sign; host crashes. ──
      let store = createDurableFactoryStore(new FileStore(dir));
      const factory = await factoryMidSigningRound();
      await store.saveFactory(factory);

      // ── Restart (brand-new store instance, same on-disk adapter). ──
      store = createDurableFactoryStore(new FileStore(dir));
      expect(await store.hasState()).toBe(true);
      const resumed = await store.getFactory(factory.factoryId);
      expect(resumed).toBeDefined();

      // Pending commitment and partial-signature counts survive.
      expect(resumed!.pendingCommitment).toBe(factory.pendingCommitment);
      expect(Object.keys(resumed!.pendingSignatures).sort()).toEqual(['alice', 'bob']);

      // Funding allocations unchanged — no partial-funding loss.
      expect(resumed!.allocations.alice).toBe(1000n);
      expect(resumed!.allocations.bob).toBe(500n);
      expect(resumed!.allocations.carol).toBe(500n);
      expect(resumed!.totalValue).toBe(2000n);

      // ── Round 2: carol signs and the round completes on the resumed state. ──
      const carolBundle = makeMockBundle(CAROL.publicKeyDigest);
      const completed = await acceptFactory(resumed!, carolBundle);
      expect(completed.status).toBe('active');
      expect(Object.keys(completed.pendingSignatures)).toHaveLength(0);
      enforceConservation(completed);

      await store.saveFactory(completed);
      const finalCheck = await store.getFactory(factory.factoryId);
      expect(finalCheck!.status).toBe('active');
    });

    it('does not fail-open on a corrupt registry record (strict)', async () => {
      const adapter = new FileStore(dir);
      const store = createDurableFactoryStore(adapter);
      const factory = await createFactory([ALICE, BOB], '0x00', makeMockBundle(ALICE.publicKeyDigest));
      await store.saveFactory(factory);

      await adapter.set('totem_omnia_factory:v1:snapshot', { shreds: true });
      await expect(store.getFactory(factory.factoryId)).rejects.toMatchObject({ code: 'corrupt' });
      // Presence is never reinitialised away.
      expect(await store.hasState()).toBe(true);
    });

    it('refuses an unsupported record version instead of reinitialising', async () => {
      const adapter = new FileStore(dir);
      const store = createDurableFactoryStore(adapter);
      const factory = await createFactory([ALICE, BOB], '0x00', makeMockBundle(ALICE.publicKeyDigest));
      await store.saveFactory(factory);

      await adapter.set('totem_omnia_factory:v1:snapshot', {
        version: 99,
        revision: 1,
        savedAt: Date.now(),
        state: { factories: {} },
      });
      await expect(store.getFactory(factory.factoryId)).rejects.toThrow(StorageError);
    });

    it('rejects a volatile adapter under the durable default (no silent downgrade)', () => {
      expect(() => createDurableFactoryStore(new MemoryStore())).toThrow(
        /acknowledges "volatile" but consumer requires "durably-acknowledged"/,
      );
    });
  });
});