/**
 * Self-hosted mode configuration (RFC-013) — PWA.
 *
 * Mirrors `extensions/totem-extension/src/core/config/selfHosted.ts` with the
 * same shared schema and resolvers, so the two wallets can host the config in a
 * toolchain-agnostic package later. Config/consent persist in localStorage
 * (small, non-secret); the WOTS watermark uses the durable
 * `@totemsdk/storage/idb` adapter.
 */

import {
  assertConsentedNodeUrl,
  resolveChainProvider,
  isSelfHosted,
} from '@totemsdk/chain-provider';
import type { ChainProviderConfig, ChainStateProvider, HostedRelayConfig } from '@totemsdk/chain-provider';
import { LocalLeaseProvider, HybridLeaseProvider } from '@totemsdk/wots-lease';
import type { OnchainWatermarkProvider, WotsLeaseProvider } from '@totemsdk/wots-lease';
import { IdbStore } from '@totemsdk/storage/idb';
import type { StorageAdapter } from '@totemsdk/core';

export type LeaseProviderMode = 'axia' | 'local' | 'hybrid';

export interface LeaseProviderConfig {
  readonly mode: LeaseProviderMode;
  readonly threshold?: number;
}

export interface WalletNetworkConfig {
  readonly chain: ChainProviderConfig;
  readonly lease: LeaseProviderConfig;
}

export const DEFAULT_WALLET_NETWORK_CONFIG: WalletNetworkConfig = {
  chain: { mode: 'axia' },
  lease: { mode: 'axia' },
};

const CONFIG_KEY = 'totem_wallet_network_config_v1';
const CONSENT_KEY = 'totem_self_hosted_node_consent_v1';

export interface WalletKeyValueStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<boolean>;
}

/** localStorage-backed key/value store (config + consent only). */
export function createLocalStorageStore(): WalletKeyValueStore {
  return {
    async get<T>(key: string): Promise<T | null> {
      const raw = localStorage.getItem(key);
      return raw === null ? null : (JSON.parse(raw) as T);
    },
    async set<T>(key: string, value: T): Promise<void> {
      localStorage.setItem(key, JSON.stringify(value));
    },
    async remove(key: string): Promise<boolean> {
      const had = localStorage.getItem(key) !== null;
      localStorage.removeItem(key);
      return had;
    },
  };
}

const consentedHosts = new Set<string>();

function hostnameOf(url: string): string {
  return new URL(url).hostname;
}

export function registerConsentedHost(url: string): void {
  consentedHosts.add(hostnameOf(url));
}

export function isConsentedHost(url: string): boolean {
  return consentedHosts.has(hostnameOf(url));
}

export function clearConsentedHosts(): void {
  consentedHosts.clear();
}

export async function loadWalletNetworkConfig(store: WalletKeyValueStore): Promise<WalletNetworkConfig> {
  const stored = await store.get<Partial<WalletNetworkConfig>>(CONFIG_KEY);
  if (!stored) return { ...DEFAULT_WALLET_NETWORK_CONFIG };
  return {
    chain: { ...DEFAULT_WALLET_NETWORK_CONFIG.chain, ...(stored.chain ?? {}) },
    lease: { ...DEFAULT_WALLET_NETWORK_CONFIG.lease, ...(stored.lease ?? {}) },
  };
}

export async function saveWalletNetworkConfig(
  store: WalletKeyValueStore,
  config: WalletNetworkConfig,
): Promise<void> {
  if (isSelfHosted(config.chain) && !config.chain.minimaRpcUrl) {
    throw new Error('Self-hosted chain mode requires a node URL.');
  }
  if (config.chain.minimaRpcUrl) assertConsentedNodeUrl(config.chain.minimaRpcUrl);
  await store.set(CONFIG_KEY, config);
}

export async function recordSelfHostedConsent(store: WalletKeyValueStore, nodeUrl: string): Promise<void> {
  assertConsentedNodeUrl(nodeUrl);
  registerConsentedHost(nodeUrl);
  await store.set(CONSENT_KEY, nodeUrl);
}

export async function restoreSelfHostedConsent(store: WalletKeyValueStore): Promise<void> {
  const config = await loadWalletNetworkConfig(store);
  if (!config.chain.minimaRpcUrl) return;
  const consented = await store.get<string>(CONSENT_KEY);
  if (consented !== config.chain.minimaRpcUrl) {
    throw new Error('Configured node URL is not consented; refusing to use it.');
  }
  registerConsentedHost(config.chain.minimaRpcUrl);
}

export function buildWalletChainProvider(
  config: ChainProviderConfig,
  options: { hosted: HostedRelayConfig; onFallback?: (method: string, error: unknown) => void },
): ChainStateProvider {
  return resolveChainProvider(config, {
    hosted: options.hosted,
    ...(options.onFallback ? { onFallback: options.onFallback } : {}),
  });
}

export interface BuildLeaseProviderOptions {
  /** Durable watermark storage. Defaults to a new IndexedDB `IdbStore`. */
  readonly storage?: StorageAdapter;
  readonly deviceId?: string;
  readonly onchain?: OnchainWatermarkProvider;
}

/** Create the durable IndexedDB watermark store used by self-hosted lease modes. */
export function createLeaseStorage(databaseName = 'totem-pwa-lease'): StorageAdapter {
  return new IdbStore({ databaseName, storeName: 'kv' });
}

/**
 * Build the WOTS lease provider for self-hosted modes (RFC-013 §8). Returns
 * `null` for `axia` mode, where the wallet keeps using its Axia lease path.
 */
export function buildWalletLeaseProvider(
  config: LeaseProviderConfig,
  options: BuildLeaseProviderOptions = {},
): WotsLeaseProvider | null {
  if (config.mode === 'axia') return null;
  const storage = options.storage ?? createLeaseStorage();
  const local = new LocalLeaseProvider(storage, undefined, options.deviceId ?? 'pwa');
  if (config.mode === 'local') return local;
  return new HybridLeaseProvider({
    local,
    ...(options.onchain ? { onchain: options.onchain } : {}),
    ...(config.threshold !== undefined ? { threshold: config.threshold } : {}),
  });
}
