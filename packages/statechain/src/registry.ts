import { HttpSEClient } from './httpClient.js';

export interface SERegistryEntry {
  sePublicKey: string;
  url: string;
  name: string;
  feeBasisPoints: number;
  chainCount: number;
  verified: boolean;
  axiaHosted: boolean;
  announcedAt: string;
  expiresAt: string;
}

export class SENotFoundError extends Error {
  constructor(sePublicKeyHex: string) {
    super(`No SE registered for public key: ${sePublicKeyHex}`);
    this.name = 'SENotFoundError';
  }
}

const DEFAULT_REGISTRY_URL = 'https://api.axia.to/public/se-registry';
const CACHE_TTL_MS = 60_000;

interface CacheEntry {
  entries: SERegistryEntry[];
  fetchedAt: number;
}

const _cache = new Map<string, CacheEntry>();

/** Fetch and cache the SE registry from a given URL. */
export async function fetchSeRegistry(
  registryUrl = DEFAULT_REGISTRY_URL,
  fetchImpl?: typeof globalThis.fetch,
): Promise<SERegistryEntry[]> {
  const cached = _cache.get(registryUrl);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.entries;
  }

  const fetchFn = fetchImpl ?? globalThis.fetch;
  if (!fetchFn) throw new Error('resolveSEClient requires a fetch implementation (Node 18+ or pass opts.fetch)');

  const res = await fetchFn(registryUrl);
  if (!res.ok) throw new Error(`SE registry fetch failed: ${res.status}`);
  const entries = (await res.json()) as SERegistryEntry[];
  _cache.set(registryUrl, { entries, fetchedAt: Date.now() });
  return entries;
}

/** Clear the in-memory registry cache (useful in tests). */
export function clearSeRegistryCache(): void {
  _cache.clear();
}

export interface ResolveSEClientOptions {
  registryUrl?: string;
  fetch?: typeof globalThis.fetch;
  /** Timeout for SE HTTP requests in milliseconds. Default 30 000. */
  timeoutMs?: number;
}

/**
 * Resolve an HttpSEClient for a given SE public key by looking it up in the
 * SE Registry. Caches the registry response for 60 seconds.
 *
 * @param sePublicKeyHex - The SE WOTS public key digest stored in the statechain.
 * @param ownerSign      - Function that signs sha3_256(nonce) with the current owner's WOTS key.
 * @param opts           - Optional registry URL, fetch impl, and timeout.
 * @throws SENotFoundError if no entry matches sePublicKeyHex.
 */
export async function resolveSEClient(
  sePublicKeyHex: string,
  ownerSign: (nonce: string) => Promise<Uint8Array>,
  opts: ResolveSEClientOptions = {},
): Promise<HttpSEClient> {
  const entries = await fetchSeRegistry(opts.registryUrl, opts.fetch);
  const entry = entries.find((e) => e.sePublicKey === sePublicKeyHex);
  if (!entry) throw new SENotFoundError(sePublicKeyHex);
  return new HttpSEClient(entry.url, ownerSign, { fetch: opts.fetch, timeoutMs: opts.timeoutMs });
}
