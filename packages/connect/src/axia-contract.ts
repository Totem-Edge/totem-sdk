/**
 * @module @totemsdk/connect/axia-contract
 *
 * Client for the Axia public API contract (RFC-0002, owned by `axia-platform`).
 *
 * RFC-015 §5.1 / RFC-014 §6.5: the wallet is the **source of truth** for its
 * method-support manifest. Axia mirrors it (`POST /public/wallet-capabilities`,
 * admin-guarded) so dApps read one authoritative manifest (`GET`). This module
 * provides the wallet-side publish and the shared fetch/validate/diff helpers so
 * the SDK and wallets agree with the contract without re-declaring shapes.
 *
 * The executable contract lives in `axia-platform`'s `@axia/contracts` package.
 * That package pins Zod 3 while this workspace resolves Zod 4 and is not yet
 * published, so the P0 shapes are mirrored structurally here (see
 * `docs/AXIA-RFC-015-PLAN.md` §4.2). The validators below are written so that a
 * future direct `@axia/contracts` import can replace them without changing
 * callers.
 */

import type { WalletCapabilityManifest } from './wallet.js';

/** Default hosted Axia endpoint. */
export const AXIA_DEFAULT_API_BASE = 'https://api.axia.to';

export interface AxiaContractClientOptions {
  /** Axia base URL. Defaults to {@link AXIA_DEFAULT_API_BASE}. */
  readonly baseUrl?: string;
  /** Fetch implementation. Defaults to `globalThis.fetch` (Node 18+). */
  readonly fetch?: typeof globalThis.fetch;
  /** Admin key for the mirror write (`x-admin-key`). Never logged. */
  readonly adminKey?: string;
  /** Abort after this many ms. */
  readonly timeoutMs?: number;
}

export class AxiaContractError extends Error {
  readonly status: number;
  readonly body: unknown;
  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = 'AxiaContractError';
    this.status = status;
    this.body = body;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Structural check for the RFC-014 §6.5 / RFC-0002 §4.2a manifest. Mirrors the
 * `WalletCapabilityManifest` schema in `@axia/contracts` and the Axia route's
 * `ManifestSchema`.
 */
export function isWalletCapabilityManifest(value: unknown): value is WalletCapabilityManifest {
  if (!isRecord(value)) return false;
  if (typeof value.wallet !== 'string' || value.wallet.length === 0) return false;
  if (typeof value.version !== 'string' || value.version.length === 0) return false;
  if (!isRecord(value.methods)) return false;
  for (const status of Object.values(value.methods)) {
    if (status !== 'supported' && status !== 'unsupported') return false;
  }
  if (!Array.isArray(value.capabilities)) return false;
  if (!value.capabilities.every((c) => typeof c === 'string')) return false;
  if (value.reasons !== undefined) {
    if (!isRecord(value.reasons)) return false;
    if (!Object.values(value.reasons).every((r) => typeof r === 'string')) return false;
  }
  return true;
}

/** Build the public read URL: `GET /public/wallet-capabilities?wallet=&version=`. */
export function walletCapabilitiesUrl(
  wallet: string,
  version?: string,
  baseUrl: string = AXIA_DEFAULT_API_BASE,
): string {
  const base = baseUrl.replace(/\/$/, '');
  const qs = new URLSearchParams({ wallet });
  if (version) qs.set('version', version);
  return `${base}/public/wallet-capabilities?${qs.toString()}`;
}

async function withTimeout(
  fetchImpl: typeof globalThis.fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number | undefined,
): Promise<Response> {
  if (!timeoutMs) return fetchImpl(url, init);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function resolveFetch(options: AxiaContractClientOptions): typeof globalThis.fetch {
  const impl = options.fetch ?? globalThis.fetch;
  if (!impl) {
    throw new Error('fetchAxiaWalletCapabilities requires a fetch implementation (Node 18+ or pass options.fetch)');
  }
  return impl;
}

/**
 * Read a wallet's capability manifest as mirrored by Axia. The wallet is the
 * source of truth; this is the discovery read used by dApps and by the wallet to
 * verify its own mirror.
 */
export async function fetchAxiaWalletCapabilities(
  wallet: string,
  options: AxiaContractClientOptions & { version?: string } = {},
): Promise<WalletCapabilityManifest> {
  const impl = resolveFetch(options);
  const url = walletCapabilitiesUrl(wallet, options.version, options.baseUrl);
  const res = await withTimeout(impl, url, { method: 'GET', headers: { accept: 'application/json' } }, options.timeoutMs);
  if (!res.ok) {
    throw new AxiaContractError(`Axia wallet-capabilities read failed: HTTP ${res.status}`, res.status);
  }
  const body = (await res.json()) as unknown;
  if (!isWalletCapabilityManifest(body)) {
    throw new AxiaContractError('Axia wallet-capabilities response did not match the RFC-014 manifest shape', 200, body);
  }
  return body;
}

export interface PublishCapabilityResult {
  readonly ok: boolean;
  readonly wallet: string;
  readonly version: string;
}

/**
 * Publish (mirror) a wallet's manifest to Axia. Admin-guarded on the server;
 * `options.adminKey` is required and never logged.
 */
export async function publishAxiaWalletCapabilities(
  manifest: WalletCapabilityManifest,
  options: AxiaContractClientOptions = {},
): Promise<PublishCapabilityResult> {
  if (!options.adminKey) throw new Error('publishAxiaWalletCapabilities requires options.adminKey');
  if (!isWalletCapabilityManifest(manifest)) throw new Error('publishAxiaWalletCapabilities: manifest does not match the RFC-014 shape');
  const impl = resolveFetch(options);
  const base = (options.baseUrl ?? AXIA_DEFAULT_API_BASE).replace(/\/$/, '');
  const res = await withTimeout(
    impl,
    `${base}/public/wallet-capabilities`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-admin-key': options.adminKey },
      body: JSON.stringify(manifest),
    },
    options.timeoutMs,
  );
  if (!res.ok) {
    throw new AxiaContractError(`Axia wallet-capabilities mirror write failed: HTTP ${res.status}`, res.status);
  }
  return (await res.json()) as PublishCapabilityResult;
}

export interface ManifestDrift {
  readonly kind: 'missing-method' | 'extra-method' | 'method-status' | 'missing-capability' | 'extra-capability';
  readonly key: string;
  readonly local?: string;
  readonly remote?: string;
}

/**
 * Compare the wallet's locally-built manifest (source of truth) with the one
 * Axia serves. An empty result means the mirror is in sync. Used by the
 * anti-drift gate and by wallets that re-publish on mismatch.
 */
export function diffWalletCapabilityManifests(
  local: WalletCapabilityManifest,
  remote: WalletCapabilityManifest,
): ManifestDrift[] {
  const drift: ManifestDrift[] = [];
  const localMethods = local.methods;
  const remoteMethods = remote.methods;
  for (const [method, status] of Object.entries(localMethods)) {
    if (!(method in remoteMethods)) {
      drift.push({ kind: 'missing-method', key: method, local: status });
    } else if (remoteMethods[method] !== status) {
      drift.push({ kind: 'method-status', key: method, local: status, remote: remoteMethods[method] });
    }
  }
  for (const method of Object.keys(remoteMethods)) {
    if (!(method in localMethods)) drift.push({ kind: 'extra-method', key: method, remote: remoteMethods[method] });
  }
  const localCaps = new Set(local.capabilities);
  const remoteCaps = new Set(remote.capabilities);
  for (const cap of localCaps) if (!remoteCaps.has(cap)) drift.push({ kind: 'missing-capability', key: cap });
  for (const cap of remoteCaps) if (!localCaps.has(cap)) drift.push({ kind: 'extra-capability', key: cap });
  return drift;
}
