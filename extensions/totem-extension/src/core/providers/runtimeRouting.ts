/**
 * Runtime view of the RFC-062 pairing capability map.
 *
 * `routing.ts` is the single source of truth for which paired-node
 * capabilities exist. This module binds it to chrome.storage so the background
 * (chain, lease, provider mode, transaction backend) reads the same map.
 */

import {
  buildProviderRouting,
  loadStoredPairing,
  type ProviderRouting,
  type ProviderRoute,
  type RoutingStorage,
  type StoredPairing,
} from './routing';

const storage: RoutingStorage = {
  get: <T,>(key: string) =>
    new Promise<T | null>((resolve) => {
      chrome.storage.local.get(key, (result) => resolve((result?.[key] as T) ?? null));
    }),
};

export async function loadRuntimePairing(): Promise<StoredPairing | null> {
  try {
    return await loadStoredPairing(storage);
  } catch {
    return null;
  }
}

export async function loadRuntimeRouting(options?: {
  allowAxiaFallback?: boolean;
}): Promise<ProviderRouting> {
  return buildProviderRouting(await loadRuntimePairing(), options);
}

/**
 * Derived provider mode (RFC-062 Amendment A A1). Kept as an accessor rather
 * than a new persisted field so existing `chain.mode` configs keep working.
 * A pairing is the authority; manual `minima-rpc` config is handled by the
 * chain resolver, not by this accessor.
 */
export async function resolveProviderMode(): Promise<'axia' | 'hawk'> {
  const routing = await loadRuntimeRouting();
  if (!routing.pairedNode) return 'axia';

  const nodeSourced =
    routing.chain.source === 'node' ||
    routing.lease.source === 'node' ||
    routing.omnia.source === 'node' ||
    routing.p2p.source === 'node' ||
    routing.realtime.source === 'node' ||
    routing.indexer.source === 'node';

  return nodeSourced ? 'hawk' : 'axia';
}

export async function resolveChainRoute(): Promise<ProviderRoute> {
  return (await loadRuntimeRouting()).chain;
}

export async function resolveLeaseRoute(): Promise<ProviderRoute> {
  return (await loadRuntimeRouting()).lease;
}

export async function resolveOmniaRoute(): Promise<ProviderRoute> {
  return (await loadRuntimeRouting()).omnia;
}

export async function resolveP2PRoute(): Promise<ProviderRoute> {
  return (await loadRuntimeRouting()).p2p;
}

export async function resolveRealtimeRoute(): Promise<ProviderRoute> {
  return (await loadRuntimeRouting()).realtime;
}

export async function resolveIndexerRoute(): Promise<ProviderRoute> {
  return (await loadRuntimeRouting()).indexer;
}
