import { MemoryStore } from '@totemsdk/storage';
import { LocalLeaseProvider, HybridLeaseProvider } from '@totemsdk/wots-lease';
import {
  DEFAULT_WALLET_NETWORK_CONFIG,
  loadWalletNetworkConfig,
  saveWalletNetworkConfig,
  recordSelfHostedConsent,
  restoreSelfHostedConsent,
  buildWalletChainProvider,
  buildWalletLeaseProvider,
  type WalletKeyValueStore,
} from '../src/core/config/selfHosted';
import { clearConsentedHosts, validateNodeUrl } from '../src/core/security/consentRegistry';

function memoryKv(): WalletKeyValueStore {
  const map = new Map<string, unknown>();
  return {
    async get<T>(key: string): Promise<T | null> {
      return (map.has(key) ? (map.get(key) as T) : null);
    },
    async set<T>(key: string, value: T): Promise<void> {
      map.set(key, value);
    },
    async remove(key: string): Promise<boolean> {
      return map.delete(key);
    },
  };
}

const hosted = { baseUrl: 'https://api.axia.to', apiKey: 'totem-shared' };

afterEach(() => clearConsentedHosts());

describe('wallet network config persistence', () => {
  it('defaults to Axia for chain and lease', async () => {
    const config = await loadWalletNetworkConfig(memoryKv());
    expect(config).toEqual(DEFAULT_WALLET_NETWORK_CONFIG);
  });

  it('round-trips a self-hosted config', async () => {
    const store = memoryKv();
    const config = {
      chain: { mode: 'composite' as const, minimaRpcUrl: 'https://node.example.com:9005', fallbackToAxia: true },
      lease: { mode: 'hybrid' as const, threshold: 100 },
    };
    await saveWalletNetworkConfig(store, config);
    expect(await loadWalletNetworkConfig(store)).toEqual(config);
  });

  it('rejects self-hosted chain mode without a URL', async () => {
    await expect(
      saveWalletNetworkConfig(memoryKv(), { chain: { mode: 'minima-rpc' }, lease: { mode: 'axia' } }),
    ).rejects.toThrow(/requires a node URL/);
  });

  it('rejects a plaintext remote node URL', async () => {
    await expect(
      saveWalletNetworkConfig(memoryKv(), {
        chain: { mode: 'minima-rpc', minimaRpcUrl: 'http://evil.example.com:9005' },
        lease: { mode: 'axia' },
      }),
    ).rejects.toThrow(/HTTPS/);
  });
});

describe('node consent', () => {
  it('requires consent before a node URL validates', async () => {
    const store = memoryKv();
    const url = 'https://node.example.com:9005';
    expect(() => validateNodeUrl(url)).toThrow(/consent/);
    await recordSelfHostedConsent(store, url);
    expect(() => validateNodeUrl(url)).not.toThrow();
  });

  it('permits loopback http but not plaintext remote', () => {
    expect(() => validateNodeUrl('http://127.0.0.1:9005')).toThrow(/consent/);
  });

  it('fails closed when persisted config is not the consented URL', async () => {
    const store = memoryKv();
    await recordSelfHostedConsent(store, 'https://node.example.com:9005');
    await saveWalletNetworkConfig(store, {
      chain: { mode: 'minima-rpc', minimaRpcUrl: 'https://other.example.com:9005' },
      lease: { mode: 'axia' },
    });
    await expect(restoreSelfHostedConsent(store)).rejects.toThrow(/not consented/);
  });

  it('re-applies consent on cold start', async () => {
    const store = memoryKv();
    const url = 'https://node.example.com:9005';
    await recordSelfHostedConsent(store, url);
    await saveWalletNetworkConfig(store, { chain: { mode: 'minima-rpc', minimaRpcUrl: url }, lease: { mode: 'axia' } });
    clearConsentedHosts();
    await expect(restoreSelfHostedConsent(store)).resolves.toBeUndefined();
    expect(() => validateNodeUrl(url)).not.toThrow();
  });
});

describe('provider resolution', () => {
  it('resolves the hosted relay in axia mode', () => {
    const provider = buildWalletChainProvider({ mode: 'axia' }, { hosted });
    expect(typeof provider.getTip).toBe('function');
  });

  it('builds no lease provider in axia mode and local/hybrid otherwise', () => {
    const storage = new MemoryStore();
    expect(buildWalletLeaseProvider({ mode: 'axia' }, { storage })).toBeNull();
    expect(buildWalletLeaseProvider({ mode: 'local' }, { storage })).toBeInstanceOf(LocalLeaseProvider);
    expect(buildWalletLeaseProvider({ mode: 'hybrid' }, { storage })).toBeInstanceOf(HybridLeaseProvider);
  });
});
