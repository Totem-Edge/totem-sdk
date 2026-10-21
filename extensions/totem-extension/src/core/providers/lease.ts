/**
 * RFC-062 Amendment A — cross-provider WOTS lease factory.
 *
 * Axia mode and Hawk mode use the same `WotsLeaseProvider` contract:
 *   - Axia: AxiaLeaseProvider (server lease/watermark)
 *   - Hawk: local or hybrid LocalLeaseProvider (optional node/onchain anchor)
 *
 * The factory is selected from ProviderRouting; callers never branch on mode.
 */

import type { StorageAdapter } from '@totemsdk/core';
import {
  AxiaLeaseProvider,
  HybridLeaseProvider,
  LocalLeaseProvider,
  PersonalLeaseNodeProvider,
  type HybridLeaseProviderConfig,
  type PersonalLeaseNodeConfig,
  type WotsLeaseProvider,
} from '@totemsdk/wots-lease';
import type { ProviderRouting } from './routing';

export interface AxiaLeaseFactoryConfig {
  apiUrl: string;
  apiKey: string;
  rootPublicKey: string;
  storage: StorageAdapter;
}

export interface HawkLeaseFactoryConfig {
  storage: StorageAdapter;
  deviceId?: string;
  mode?: 'local' | 'hybrid';
  threshold?: number;
  /** Optional lookup-node lease coordinator (HTTP /v1/lease/*). */
  node?: PersonalLeaseNodeConfig;
  /** Optional on-chain watermark anchor. */
  onchain?: HybridLeaseProviderConfig['onchain'];
}

export function createAxiaLeaseProvider(config: AxiaLeaseFactoryConfig): WotsLeaseProvider {
  if (!config.apiUrl || !config.apiKey || !config.rootPublicKey) {
    throw new Error('Axia lease requires apiUrl, apiKey and rootPublicKey');
  }
  return new AxiaLeaseProvider({
    apiUrl: config.apiUrl,
    apiKey: config.apiKey,
    rootPublicKey: config.rootPublicKey,
    storage: config.storage,
  });
}

export function createHawkLeaseProvider(config: HawkLeaseFactoryConfig): WotsLeaseProvider {
  const local = new LocalLeaseProvider(config.storage, undefined, config.deviceId ?? 'wallet');
  const mode = config.mode ?? 'local';
  if (mode === 'local') return local;

  const node = config.node ? new PersonalLeaseNodeProvider(config.node) : undefined;
  return new HybridLeaseProvider({
    local,
    ...(node ? { node } : {}),
    ...(config.onchain ? { onchain: config.onchain } : {}),
    ...(config.threshold !== undefined ? { threshold: config.threshold } : {}),
  });
}

export function createLeaseProviderFromRouting(
  routing: ProviderRouting,
  config: { axia: AxiaLeaseFactoryConfig; hawk: HawkLeaseFactoryConfig },
): WotsLeaseProvider {
  if (routing.lease.source === 'axia') return createAxiaLeaseProvider(config.axia);
  if (routing.lease.source === 'node') return createHawkLeaseProvider(config.hawk);
  throw new Error(`lease is unavailable: ${routing.lease.reason ?? 'provider is disabled'}`);
}
