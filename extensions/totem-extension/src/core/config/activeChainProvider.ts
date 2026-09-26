/**
 * Active chain-provider resolution (RFC-013 §7).
 *
 * Reads the persisted self-hosted config + consent and returns a resolved
 * {@link ChainStateProvider} when the wallet is NOT in Axia mode. Returns `null`
 * for Axia mode (callers keep their existing Axia REST/RPC paths) or when the
 * persisted node URL is not consented (fail closed to Axia).
 */

import { resolveChainProvider } from '@totemsdk/chain-provider';
import type { ChainProviderMode, ChainStateProvider } from '@totemsdk/chain-provider';
import { getApiBase, getProjectId } from '../api/base';
import { loadWalletNetworkConfig, loadSelfHostedConsent, type WalletKeyValueStore } from './selfHosted';

const store: WalletKeyValueStore = {
  get: <T,>(key: string) =>
    new Promise<T | null>((resolve) => chrome.storage.local.getTyped([key], (r) => resolve((r[key] as T) ?? null))),
  set: <T,>(key: string, value: T) =>
    new Promise<void>((resolve) => chrome.storage.local.set({ [key]: value }, () => resolve())),
  remove: (key: string) =>
    new Promise<boolean>((resolve) => chrome.storage.local.remove(key, () => resolve(true))),
};

export interface ActiveChainProvider {
  readonly provider: ChainStateProvider;
  readonly mode: ChainProviderMode;
  readonly baseUrl: string;
}

export function activeChainProviderStore(): WalletKeyValueStore {
  return store;
}

/**
 * Resolve the user-selected chain provider, or `null` when Axia should be used
 * (default mode, or self-hosted config whose node URL is not consented).
 */
export async function resolveActiveChainProvider(): Promise<ActiveChainProvider | null> {
  const config = await loadWalletNetworkConfig(store);
  if (config.chain.mode === 'axia') return null;

  if (config.chain.minimaRpcUrl) {
    const consented = await loadSelfHostedConsent(store);
    if (consented !== config.chain.minimaRpcUrl) {
      console.warn('[chain] self-hosted node URL is not consented; staying on Axia');
      return null;
    }
  }

  const [baseUrl, apiKey] = await Promise.all([getApiBase(), getProjectId()]);
  const provider = resolveChainProvider(config.chain, {
    hosted: { baseUrl, apiKey },
    onFallback: (method, error) => console.warn(`[chain] composite fallback on ${method}:`, error),
  });
  return { provider, mode: config.chain.mode, baseUrl };
}
