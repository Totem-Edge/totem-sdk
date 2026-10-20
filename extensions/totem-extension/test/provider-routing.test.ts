/**
 * RFC-062 — provider routing from a paired node capability map.
 */

import {
  buildProviderRouting,
  loadProviderRouting,
  routeFor,
  type StoredPairing,
} from '../src/core/providers/routing';

function paired(overrides: Partial<StoredPairing> = {}): StoredPairing {
  return {
    endpoint: 'http://127.0.0.1:7789',
    nodeId: 'node-1',
    fingerprint: 'fp-1',
    network: 'minima',
    scopes: ['chain.read', 'chain.submit', 'p2p.pubsub'],
    capabilities: {
      chain: { rpcUrl: 'http://127.0.0.1:9005', network: 'minima' },
      lease: { modes: ['local', 'hybrid'] },
      omnia: { hostControlUrl: 'http://127.0.0.1:50052' },
      p2p: { hubUrl: 'ws://127.0.0.1:7788', scopes: ['p2p.pubsub'] },
    },
    pairedAt: 1,
    ...overrides,
  };
}

describe('provider routing', () => {
  it('uses Axia when no node is paired', () => {
    const routing = buildProviderRouting(null);
    expect(routing.chain.source).toBe('axia');
    expect(routing.lease.source).toBe('axia');
    expect(routing.p2p.source).toBe('disabled');
  });

  it('routes advertised capabilities to the paired node', () => {
    const routing = buildProviderRouting(paired());
    expect(routing.chain).toMatchObject({ source: 'node', url: 'http://127.0.0.1:9005' });
    expect(routing.lease.source).toBe('node');
    expect(routing.omnia).toMatchObject({ source: 'node', url: 'http://127.0.0.1:50052' });
    expect(routing.p2p).toMatchObject({ source: 'node', url: 'ws://127.0.0.1:7788' });
    expect(routing.fallbackToAxia).toBe(false);
  });

  it('disables unadvertised non-P2P features unless fallback is explicit', () => {
    const routing = buildProviderRouting(paired());
    expect(routeFor(routing, 'realtime')).toMatchObject({ source: 'disabled' });
    expect(routeFor(routing, 'indexer')).toMatchObject({ source: 'disabled' });

    const withFallback = buildProviderRouting(paired(), { allowAxiaFallback: true });
    expect(routeFor(withFallback, 'realtime')).toMatchObject({ source: 'axia' });
    expect(routeFor(withFallback, 'indexer')).toMatchObject({ source: 'axia' });
  });

  it('never falls back to Axia for P2P', () => {
    const routing = buildProviderRouting(paired({
      capabilities: { chain: { rpcUrl: 'http://127.0.0.1:9005', network: 'minima' } },
    }), { allowAxiaFallback: true });
    expect(routing.p2p.source).toBe('disabled');
  });

  it('loads the pairing record from storage', async () => {
    const routing = await loadProviderRouting({
      get: async <T>(key: string) => (key === 'self_hosted_pairing' ? paired() as T : null),
    });
    expect(routing.pairedNode?.nodeId).toBe('node-1');
    expect(routing.chain.source).toBe('node');
  });
});
