/**
 * Durable provider-bond/claim registry tests (RFC-007 G6).
 *
 * Drop-in parity with `MemoryProviderBondStore`, plus the Phase 3 gates:
 * reopen survival, concurrent transition safety (revision-CAS), corrupt
 * records surfaced (never treated as absence), and no-silent-downgrade.
 */

import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { MemoryStore } from '@totemsdk/storage';
import { FileStore } from '@totemsdk/storage/fs';
import { StorageError } from '@totemsdk/storage/errors';
import { createDurableProviderBondStore } from '../durable-store.js';
import { createProviderBondManifest } from '../manifest.js';
import { recordProbe } from '../probes.js';
import { recordIncident } from '../incidents.js';
import { computeProviderScore } from '../scoring.js';
import type { EdgeServiceManifest } from '@totemsdk/manifest';
import type { ProviderBondManifest } from '../types.js';

const VOLATILE = { requireAckMode: 'volatile' as const };

function makeManifest(providerId: string): ProviderBondManifest {
  const edgeService: EdgeServiceManifest = {
    type: 'edge-service', serviceId: `svc-${providerId}`, name: 'Test', version: '1.0.0',
    operatorAddress: 'MxRoot', serviceType: 'lookup-provider', description: '',
    capabilities: [], tags: [],
  };
  return createProviderBondManifest({
    edgeService,
    providerBond: { providerId },
  });
}

describe('createDurableProviderBondStore', () => {
  describe('MemoryStore (volatile) — drop-in parity with MemoryProviderBondStore', () => {
    let store: ReturnType<typeof createDurableProviderBondStore>;

    beforeEach(() => {
      store = createDurableProviderBondStore(new MemoryStore(), VOLATILE);
    });

    it('registers and lists providers', async () => {
      await store.registerProvider(makeManifest('p-1'));
      const providers = await store.listProviders();
      expect(providers).toHaveLength(1);
    });

    it('gets a provider by ID', async () => {
      await store.registerProvider(makeManifest('p-1'));
      const p = await store.getProvider('p-1');
      expect(p).toBeDefined();
      const missing = await store.getProvider('p-2');
      expect(missing).toBeUndefined();
    });

    it('attaches bond proofs', async () => {
      await store.registerProvider(makeManifest('p-1'));
      await store.attachBondProof('p-1', {
        proofId: 'pr-1', bondId: 'b-1', providerId: 'p-1',
        proofType: 'manual', asset: 'MINIMA', amount: 1000n,
      });
      const snapshot = await store.getSnapshot();
      expect(snapshot.bondProofs['p-1']).toHaveLength(1);
    });

    it('records probes, incidents and scores', async () => {
      await store.registerProvider(makeManifest('p-1'));
      const probe = recordProbe({ providerId: 'p-1', type: 'heartbeat', ok: true, now: 1000 });
      await store.recordProbe('p-1', probe);
      const incident = recordIncident({ providerId: 'p-1', type: 'downtime', severity: 'high', now: 1000 });
      await store.recordIncident('p-1', incident);
      const provider = await store.getProvider('p-1');
      const score = computeProviderScore({ provider: provider!, now: 1000 });
      await store.updateScore('p-1', score);
      const snapshot = await store.getSnapshot();
      expect(snapshot.probes['p-1']).toHaveLength(1);
      expect(snapshot.incidents['p-1']).toHaveLength(1);
      expect(snapshot.scores['p-1']).toBeDefined();
    });

    it('filters by service type and risky/offline heuristics', async () => {
      await store.registerProvider(makeManifest('p-1'));
      const manifest2 = makeManifest('p-2');
      await store.registerProvider(manifest2);
      await store.updateProviderManifest({
        ...manifest2,
        edgeService: { ...manifest2.edgeService, serviceType: 'omnia-router' as any },
      });
      expect(await store.listProvidersByServiceType('omnia-router')).toHaveLength(1);
      expect(await store.listRiskyProviders(0)).toHaveLength(0);
      expect(await store.listOfflineProviders(1000, 1)).toHaveLength(2);
    });

    it('returns cloned snapshots', async () => {
      await store.registerProvider(makeManifest('p-1'));
      const snap1 = await store.getSnapshot();
      const snap2 = await store.getSnapshot();
      expect(snap1).not.toBe(snap2);
      expect(snap1.providers).not.toBe(snap2.providers);
    });

    it('survives a full store restart over the same adapter (reopen)', async () => {
      const adapter = new MemoryStore();
      const first = createDurableProviderBondStore(adapter, VOLATILE);
      await first.registerProvider(makeManifest('p-1'));
      await first.attachBondProof('p-1', {
        proofId: 'pr-1', bondId: 'b-1', providerId: 'p-1',
        proofType: 'manual', asset: 'MINIMA', amount: 1000n,
      });

      const reopened = createDurableProviderBondStore(adapter, VOLATILE);
      expect(await reopened.getProvider('p-1')).toBeDefined();
      expect((await reopened.getSnapshot()).bondProofs['p-1']).toHaveLength(1);
      expect(await reopened.getRevision()).toBe(2);
      expect(await reopened.hasState()).toBe(true);
    });

    it('keeps bigint-typed bond amounts as bigint through the store', async () => {
      const adapter = new MemoryStore();
      const first = createDurableProviderBondStore(adapter, VOLATILE);
      await first.registerProvider(makeManifest('p-1'));
      await first.attachBondProof('p-1', {
        proofId: 'pr-1', bondId: 'b-1', providerId: 'p-1',
        proofType: 'manual', asset: 'MINIMA', amount: 1000n,
      });

      const raw = await adapter.get<{ state: { bondProofs: Record<string, Array<{ amount: bigint }>> } }>('totem_bond:v1:snapshot');
      expect(raw?.state.bondProofs['p-1'][0].amount).toBe(1000n);
    });

    it('serializes concurrent registrations without a lost update (revision-CAS)', async () => {
      const store = createDurableProviderBondStore(new MemoryStore(), VOLATILE);
      await Promise.all(
        Array.from({ length: 20 }, (_, i) => store.registerProvider(makeManifest(`p-${i}`))),
      );
      expect(await store.listProviders()).toHaveLength(20);
    });
  });

  describe('FileStore (durably-acknowledged) — durable close/reopen', () => {
    let dir: string;

    beforeEach(async () => {
      dir = await fs.mkdtemp(join(tmpdir(), 'totem-bond-'));
    });

    afterEach(async () => {
      await fs.rm(dir, { recursive: true, force: true });
    });

    it('does not fail-open on a corrupt registry record (strict)', async () => {
      const adapter = new FileStore(dir);
      const store = createDurableProviderBondStore(adapter);
      await store.registerProvider(makeManifest('p-1'));
      await store.attachBondProof('p-1', {
        proofId: 'pr-1', bondId: 'b-1', providerId: 'p-1',
        proofType: 'manual', asset: 'MINIMA', amount: 1000n,
      });

      // Clobber the registry record with junk through the adapter.
      await adapter.set('totem_bond:v1:snapshot', { shreds: true });

      await expect(store.getProvider('p-1')).rejects.toMatchObject({ code: 'corrupt' });
      // The record is present-but-broken — presence is never reinitialised away.
      expect(await store.hasState()).toBe(true);
    });

    it('reopens on-disk state after a brand-new store instance (registry reopen gate)', async () => {
      const adapter1 = new FileStore(dir);
      const first = createDurableProviderBondStore(adapter1);
      await first.registerProvider(makeManifest('p-1'));
      await first.recordProbe('p-1', recordProbe({ providerId: 'p-1', type: 'heartbeat', ok: true, now: 5000 }));
      await first.attachBondProof('p-1', {
        proofId: 'pr-9', bondId: 'b-9', providerId: 'p-1',
        proofType: 'manual', asset: 'MINIMA', amount: 9000n,
      });

      const adapter2 = new FileStore(dir);
      const reopened = createDurableProviderBondStore(adapter2);
      const snapshot = await reopened.getSnapshot();
      expect(snapshot.providers['p-1']).toBeDefined();
      expect(snapshot.probes['p-1'][0].ok).toBe(true);
      expect(snapshot.bondProofs['p-1'][0].amount).toBe('9000');
    });

    it('throws StorageError on tampered on-disk bytes', async () => {
      const adapter = new FileStore(dir);
      const store = createDurableProviderBondStore(adapter);
      await store.registerProvider(makeManifest('p-1'));

      for (const file of await fs.readdir(dir)) {
        if (file.startsWith('.tmp')) continue;
        await fs.writeFile(join(dir, file), Buffer.from('TAMPERED'));
      }
      await expect(store.listProviders()).rejects.toThrow(StorageError);
    });
  });

  it('rejects a volatile adapter under the durable default (no silent downgrade)', () => {
    expect(() => createDurableProviderBondStore(new MemoryStore())).toThrow(
      /acknowledges "volatile" but consumer requires "durably-acknowledged"/,
    );
  });
});