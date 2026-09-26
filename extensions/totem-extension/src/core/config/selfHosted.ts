/**
 * Self-hosted mode configuration (RFC-013).
 *
 * Persists the user's chain-provider and WOTS-lease selection and resolves them
 * into SDK providers. Axia remains the default; self-hosted is opt-in and
 * reversible. This module is storage-agnostic (an injected key/value store) so
 * it is unit-testable without chrome APIs.
 */

import {
  assertConsentedNodeUrl,
  resolveChainProvider,
  isSelfHosted,
} from '@totemsdk/chain-provider';
import type {
  ChainProviderConfig,
  ChainStateProvider,
  HostedRelayConfig,
} from '@totemsdk/chain-provider';
import { LocalLeaseProvider, HybridLeaseProvider } from '@totemsdk/wots-lease';
import type { OnchainWatermarkProvider, WotsLeaseProvider } from '@totemsdk/wots-lease';
import type { StorageAdapter } from '@totemsdk/core';
import { registerConsentedHost, validateNodeUrl } from '../security/consentRegistry';

export type LeaseProviderMode = 'axia' | 'local' | 'hybrid';

export interface LeaseProviderConfig {
  /** `axia` (default) | `local` (device-only) | `hybrid` (device + on-chain anchor). */
  mode: LeaseProviderMode;
  /** Hybrid: value threshold above which the on-chain cursor is consulted. */
  threshold?: number;
}

export interface WalletNetworkConfig {
  chain: ChainProviderConfig;
  lease: LeaseProviderConfig;
}

export const DEFAULT_WALLET_NETWORK_CONFIG: WalletNetworkConfig = {
  chain: { mode: 'axia' },
  lease: { mode: 'axia' },
};

export const NETWORK_CONFIG_KEY = 'wallet_network_config';
export const NODE_CONSENT_KEY = 'self_hosted_node_consent';

/** Minimal key/value store (chrome.storage.local-like). */
export interface WalletKeyValueStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<boolean>;
}

export async function loadWalletNetworkConfig(
  store: WalletKeyValueStore,
): Promise<WalletNetworkConfig> {
  const stored = await store.get<Partial<WalletNetworkConfig>>(NETWORK_CONFIG_KEY);
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
  if (config.chain.minimaRpcUrl) {
    assertConsentedNodeUrl(config.chain.minimaRpcUrl);
  }
  await store.set(NETWORK_CONFIG_KEY, config);
}

/**
 * Record explicit user consent for a node URL. Called only from the Settings
 * "Test connection / Save" flow after the user opts in.
 */
export async function recordSelfHostedConsent(
  store: WalletKeyValueStore,
  nodeUrl: string,
): Promise<void> {
  assertConsentedNodeUrl(nodeUrl);
  registerConsentedHost(nodeUrl);
  await store.set(NODE_CONSENT_KEY, nodeUrl);
}

export async function loadSelfHostedConsent(
  store: WalletKeyValueStore,
): Promise<string | null> {
  return store.get<string>(NODE_CONSENT_KEY);
}

/**
 * Re-apply persisted consent on cold start and confirm the configured node URL
 * is still consented. Throws (fail closed) if the persisted node URL is not
 * consented, so a tampered config cannot silently route traffic.
 */
export async function restoreSelfHostedConsent(store: WalletKeyValueStore): Promise<void> {
  const config = await loadWalletNetworkConfig(store);
  if (!config.chain.minimaRpcUrl) return;
  const consented = await loadSelfHostedConsent(store);
  if (consented !== config.chain.minimaRpcUrl) {
    throw new Error('Configured node URL is not consented; refusing to use it.');
  }
  registerConsentedHost(config.chain.minimaRpcUrl);
  validateNodeUrl(config.chain.minimaRpcUrl);
}

/** Build the chain provider selected by the config (RFC-013 §7). */
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
  /** Durable storage for the local watermark (e.g. IdbStore). */
  readonly storage: StorageAdapter;
  readonly deviceId?: string;
  /** Layer 5 provider for `hybrid` mode. */
  readonly onchain?: OnchainWatermarkProvider;
}

/**
 * Build the WOTS lease provider for self-hosted modes (RFC-013 §8). Returns
 * `null` for `axia` mode, where the wallet keeps using its Axia lease path.
 */
export function buildWalletLeaseProvider(
  config: LeaseProviderConfig,
  options: BuildLeaseProviderOptions,
): WotsLeaseProvider | null {
  if (config.mode === 'axia') return null;
  const local = new LocalLeaseProvider(options.storage, undefined, options.deviceId ?? 'wallet');
  if (config.mode === 'local') return local;
  return new HybridLeaseProvider({
    local,
    ...(options.onchain ? { onchain: options.onchain } : {}),
    ...(config.threshold !== undefined ? { threshold: config.threshold } : {}),
  });
}
