/**
 * RFC-062 provider routing.
 *
 * Pairing returns a capability map. The extension must route each feature to
 * the advertised provider instead of switching every Axia call to a node URL.
 * Missing capabilities are disabled unless the user explicitly allows Axia
 * fallback. P2P has no Axia equivalent and never falls back.
 */

export type ProviderFeature = 'chain' | 'lease' | 'omnia' | 'p2p' | 'realtime' | 'indexer';
export type ProviderSource = 'node' | 'axia' | 'disabled';

export interface PairingCapabilities {
  chain?: { rpcUrl: string; network: string; genesisHash?: string };
  lease?: { modes: Array<'local' | 'hybrid'>; onchainWatermarkUrl?: string };
  omnia?: { relayUrl?: string; hostControlUrl?: string; transportPubkey?: string };
  p2p?: { hubUrl: string; token?: string; scopes: Array<'p2p.pubsub'>; topicPrefixes?: string[] };
  realtime?: { wsUrl: string };
  indexer?: { baseUrl: string };
}

export interface StoredPairing {
  endpoint: string;
  nodeId: string;
  fingerprint: string;
  network: string;
  scopes: string[];
  capabilities?: PairingCapabilities;
  pairedAt: number;
  clientId?: string;
}

export interface ProviderRoute {
  source: ProviderSource;
  url?: string;
  reason?: string;
}

export interface ProviderRouting {
  pairedNode?: Pick<StoredPairing, 'endpoint' | 'nodeId' | 'fingerprint' | 'network'>;
  chain: ProviderRoute;
  lease: ProviderRoute;
  omnia: ProviderRoute;
  p2p: ProviderRoute;
  realtime: ProviderRoute;
  indexer: ProviderRoute;
  fallbackToAxia: boolean;
}

export const PAIRING_STORAGE_KEY = 'self_hosted_pairing';
export const P2P_HUB_STORAGE_KEY = 'p2p_hub_config';

export interface RoutingStorage {
  get<T>(key: string): Promise<T | null>;
}

export interface ProviderRoutingOptions {
  /** When true, a missing node capability may use Axia. Default false. */
  allowAxiaFallback?: boolean;
}

function missing(feature: ProviderFeature, fallback: boolean): ProviderRoute {
  return fallback
    ? { source: 'axia', reason: `${feature} is not advertised by the paired node; using Axia by explicit choice` }
    : { source: 'disabled', reason: `${feature} is not advertised by the paired node` };
}

export function buildProviderRouting(
  pairing: StoredPairing | null | undefined,
  options: ProviderRoutingOptions = {},
): ProviderRouting {
  const fallback = options.allowAxiaFallback === true;
  if (!pairing) {
    return {
      chain: { source: 'axia' },
      lease: { source: 'axia' },
      omnia: { source: 'axia' },
      p2p: { source: 'disabled', reason: 'no local P2P hub paired' },
      realtime: { source: 'axia' },
      indexer: { source: 'axia' },
      fallbackToAxia: true,
    };
  }

  const caps = pairing.capabilities ?? {};
  return {
    pairedNode: {
      endpoint: pairing.endpoint,
      nodeId: pairing.nodeId,
      fingerprint: pairing.fingerprint,
      network: pairing.network,
    },
    chain: caps.chain?.rpcUrl
      ? { source: 'node', url: caps.chain.rpcUrl }
      : missing('chain', fallback),
    lease: caps.lease?.modes?.length
      ? { source: 'node', reason: caps.lease.modes.join(',') }
      : missing('lease', fallback),
    omnia: caps.omnia?.hostControlUrl || caps.omnia?.relayUrl
      ? { source: 'node', url: caps.omnia.hostControlUrl ?? caps.omnia.relayUrl }
      : missing('omnia', fallback),
    p2p: caps.p2p?.hubUrl
      ? { source: 'node', url: caps.p2p.hubUrl }
      : { source: 'disabled', reason: 'no local P2P hub advertised' },
    realtime: caps.realtime?.wsUrl
      ? { source: 'node', url: caps.realtime.wsUrl }
      : missing('realtime', fallback),
    indexer: caps.indexer?.baseUrl
      ? { source: 'node', url: caps.indexer.baseUrl }
      : missing('indexer', fallback),
    fallbackToAxia: fallback,
  };
}

export function routeFor(routing: ProviderRouting, feature: ProviderFeature): ProviderRoute {
  return routing[feature];
}

export async function loadStoredPairing(storage: RoutingStorage): Promise<StoredPairing | null> {
  return storage.get<StoredPairing>(PAIRING_STORAGE_KEY);
}

export async function loadProviderRouting(
  storage: RoutingStorage,
  options: ProviderRoutingOptions = {},
): Promise<ProviderRouting> {
  return buildProviderRouting(await loadStoredPairing(storage), options);
}

/** Fail closed when a feature was advertised but the required URL is missing. */
export function assertRoute(routing: ProviderRouting, feature: ProviderFeature): ProviderRoute {
  const route = routeFor(routing, feature);
  if (route.source === 'disabled') {
    throw new Error(`${feature} is unavailable: ${route.reason ?? 'provider is disabled'}`);
  }
  return route;
}
