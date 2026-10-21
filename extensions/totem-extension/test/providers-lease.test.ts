import { MemoryStore } from '@totemsdk/storage';
import { buildProviderRouting, type StoredPairing } from '../src/core/providers/routing';
import {
  createAxiaLeaseProvider,
  createHawkLeaseProvider,
  createLeaseProviderFromRouting,
} from '../src/core/providers/lease';

function pairing(): StoredPairing {
  return {
    endpoint: 'http://127.0.0.1:7789',
    nodeId: 'node-1',
    fingerprint: 'fp',
    network: 'minima',
    scopes: ['chain.read'],
    capabilities: {
      chain: { rpcUrl: 'http://127.0.0.1:9005', network: 'minima' },
      lease: { modes: ['local', 'hybrid'] },
    },
    pairedAt: 1,
  };
}

describe('cross-provider lease factory', () => {
  it('uses the Axia lease provider in Axia mode', () => {
    const routing = buildProviderRouting(null);
    const provider = createLeaseProviderFromRouting(routing, {
      axia: {
        apiUrl: 'https://api.axia.to/v1/project',
        apiKey: 'project',
        rootPublicKey: 'MxROOT',
        storage: new MemoryStore(),
      },
      hawk: { storage: new MemoryStore() },
    });
    expect(provider.constructor.name).toBe('AxiaLeaseProvider');
  });

  it('uses the local/hybrid Hawk lease in Hawk mode', async () => {
    const routing = buildProviderRouting(pairing());
    const provider = createLeaseProviderFromRouting(routing, {
      axia: {
        apiUrl: 'https://api.axia.to/v1/project',
        apiKey: 'project',
        rootPublicKey: 'MxROOT',
        storage: new MemoryStore(),
      },
      hawk: { storage: new MemoryStore(), deviceId: 'test-device' },
    });
    expect(provider.constructor.name).toBe('LocalLeaseProvider');

    const reservation = await provider.reserveKeyUse({ treeId: 'wallet' });
    await provider.commitKeyUse(reservation.reservationId, 'tx-1');
    const watermark = await provider.getLocalWatermark('wallet');
    expect(watermark.unavailableCount).toBe(1);
  });

  it('supports reserve/commit/burn through the shared interface', async () => {
    const provider = createHawkLeaseProvider({
      storage: new MemoryStore(),
      mode: 'hybrid',
      threshold: 10,
    });
    const one = await provider.reserveKeyUse({ treeId: 'tree', valueHint: '1' });
    await provider.burnReservation(one.reservationId, 'cancelled');
    const two = await provider.reserveKeyUse({ treeId: 'tree', valueHint: '1' });
    expect(two.indices).not.toEqual(one.indices);
  });

  it('fails closed when the lease capability is disabled', () => {
    const routing = buildProviderRouting({ ...pairing(), capabilities: { chain: { rpcUrl: 'x', network: 'minima' } } });
    expect(() => createLeaseProviderFromRouting(routing, {
      axia: {
        apiUrl: 'https://api.axia.to/v1/project',
        apiKey: 'project',
        rootPublicKey: 'MxROOT',
        storage: new MemoryStore(),
      },
      hawk: { storage: new MemoryStore() },
    })).toThrow(/lease is unavailable/);
  });
});
