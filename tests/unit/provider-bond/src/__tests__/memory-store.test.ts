import { MemoryProviderBondStore } from '../memory-store.js';
import { createProviderBondManifest } from '../manifest.js';
import { recordProbe } from '../probes.js';
import { recordIncident } from '../incidents.js';
import { computeProviderScore } from '../scoring.js';
import type { EdgeServiceManifest } from '@totemsdk/manifest';
import type { ProviderBondManifest } from '../types.js';

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

describe('MemoryProviderBondStore', () => {
  let store: MemoryProviderBondStore;

  beforeEach(() => {
    store = new MemoryProviderBondStore();
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

  it('records probes', async () => {
    await store.registerProvider(makeManifest('p-1'));
    const probe = recordProbe({ providerId: 'p-1', type: 'heartbeat', ok: true, now: 1000 });
    await store.recordProbe('p-1', probe);
    const snapshot = await store.getSnapshot();
    expect(snapshot.probes['p-1']).toHaveLength(1);
  });

  it('records incidents', async () => {
    await store.registerProvider(makeManifest('p-1'));
    const incident = recordIncident({ providerId: 'p-1', type: 'downtime', severity: 'high', now: 1000 });
    await store.recordIncident('p-1', incident);
    const snapshot = await store.getSnapshot();
    expect(snapshot.incidents['p-1']).toHaveLength(1);
  });

  it('updates scores', async () => {
    const manifest = makeManifest('p-1');
    await store.registerProvider(manifest);
    const score = computeProviderScore({ provider: manifest, now: 1000 });
    await store.updateScore('p-1', score);
    const snapshot = await store.getSnapshot();
    expect(snapshot.scores['p-1']).toBeDefined();
  });

  it('filters by service type', async () => {
    await store.registerProvider(makeManifest('p-1'));
    const manifest2 = makeManifest('p-2');
    await store.registerProvider(manifest2);
    await store.updateProviderManifest({
      ...manifest2,
      edgeService: { ...manifest2.edgeService, serviceType: 'omnia-router' as any },
    });
    const result = await store.listProvidersByServiceType('omnia-router');
    expect(result).toHaveLength(1);
  });

  it('returns cloned snapshots', async () => {
    await store.registerProvider(makeManifest('p-1'));
    const snap1 = await store.getSnapshot();
    const snap2 = await store.getSnapshot();
    expect(snap1).not.toBe(snap2);
    expect(snap1.providers).not.toBe(snap2.providers);
  });
});
