/**
 * @module @totemsdk/chain-provider/resolve
 *
 * User-selectable chain access (RFC-013 §7). Axia remains the default relay;
 * self-hosted mode resolves reads/broadcast through a user's own Minima node,
 * with an optional composite (node-first, Axia-fallback) mode.
 *
 * The resolver is wallet-agnostic: it takes the persisted
 * {@link ChainProviderConfig} plus the hosted-relay credentials the wallet
 * already holds, and returns a {@link ChainStateProvider}. URL consent is
 * enforced structurally (HTTPS remote, HTTP loopback only) so a hostile node URL
 * cannot be configured silently.
 */

import { createMinimaRpcClient } from '@totemsdk/minima-rpc';
import { HostedProvider } from './providers/hosted.js';
import { MinimaRpcProvider } from './providers/minima-rpc.js';
import { CompositeProvider } from './providers/composite.js';
import type { ChainStateProvider } from './types.js';

export type ChainProviderMode = 'axia' | 'minima-rpc' | 'composite';

/** Persisted, user-selectable chain access config. */
export interface ChainProviderConfig {
  readonly mode: ChainProviderMode;
  /** `http(s)://host:port` for a self-hosted Minima node. */
  readonly minimaRpcUrl?: string;
  readonly minimaRpcUser?: string;
  readonly minimaRpcPass?: string;
  /** Composite only: fall back to the hosted relay on node error. Default true. */
  readonly fallbackToAxia?: boolean;
}

export interface HostedRelayConfig {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly timeoutMs?: number;
}

export interface ResolveChainProviderOptions {
  /** Hosted relay credentials (Axia by default). */
  readonly hosted: HostedRelayConfig;
  /** Override hosted provider construction (tests / custom relay). */
  readonly hostedProvider?: ChainStateProvider;
  /** Override node provider construction (tests). */
  readonly createMinimaProvider?: (config: ChainProviderConfig) => ChainStateProvider;
  readonly onFallback?: (method: string, error: unknown) => void;
  /** URL consent check. Defaults to {@link assertConsentedNodeUrl}. */
  readonly validateUrl?: (url: string) => void;
}

const DEFAULT_RPC_PORT = 9005;

export interface ParsedMinimaRpcUrl {
  readonly host: string;
  readonly port: number;
  readonly ssl: boolean;
}

/** Parse `http(s)://host:port` into the minima-rpc client config shape. */
export function parseMinimaRpcUrl(url: string): ParsedMinimaRpcUrl {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid Minima RPC URL: ${url}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Minima RPC URL must use http: (loopback) or https:');
  }
  const ssl = parsed.protocol === 'https:';
  const port = parsed.port ? Number(parsed.port) : ssl ? 443 : DEFAULT_RPC_PORT;
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid Minima RPC port in URL: ${url}`);
  }
  return { host: parsed.hostname, port, ssl };
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';
}

/**
 * Consent guard (RFC-013 §11): HTTPS is required for remote hosts; plain `http`
 * is permitted only for loopback. Never ships a build-time localhost bypass.
 */
export function assertConsentedNodeUrl(url: string): void {
  const parsed = new URL(url);
  if (parsed.protocol === 'https:') return;
  if (parsed.protocol === 'http:' && isLoopbackHost(parsed.hostname)) return;
  throw new Error(
    'Self-hosted node URL must use HTTPS. Plain http is allowed only for localhost/127.0.0.1/::1.',
  );
}

function createNodeProvider(config: ChainProviderConfig): ChainStateProvider {
  if (!config.minimaRpcUrl) {
    throw new Error('minima-rpc mode requires minimaRpcUrl');
  }
  const { host, port, ssl } = parseMinimaRpcUrl(config.minimaRpcUrl);
  const client = createMinimaRpcClient({
    host,
    port,
    ssl,
    ...(config.minimaRpcUser ? { username: config.minimaRpcUser } : {}),
    ...(config.minimaRpcPass ? { password: config.minimaRpcPass } : {}),
  });
  return new MinimaRpcProvider(client);
}

/**
 * Resolve a {@link ChainStateProvider} from the persisted config.
 *
 * - `axia` → the hosted relay (default).
 * - `minima-rpc` → the user's own node.
 * - `composite` → node first, hosted fallback (unless `fallbackToAxia === false`).
 */
export function resolveChainProvider(
  config: ChainProviderConfig,
  options: ResolveChainProviderOptions,
): ChainStateProvider {
  const hosted = options.hostedProvider ?? new HostedProvider(options.hosted);

  if (config.mode === 'axia') {
    return hosted;
  }

  if (!config.minimaRpcUrl) {
    throw new Error(`chain provider mode "${config.mode}" requires minimaRpcUrl`);
  }
  (options.validateUrl ?? assertConsentedNodeUrl)(config.minimaRpcUrl);
  const node = options.createMinimaProvider
    ? options.createMinimaProvider(config)
    : createNodeProvider(config);

  if (config.mode === 'minima-rpc' || config.fallbackToAxia === false) {
    return node;
  }
  return new CompositeProvider(node, hosted, options.onFallback);
}

/** True when the config routes reads/broadcast away from the hosted relay. */
export function isSelfHosted(config: ChainProviderConfig): boolean {
  return config.mode === 'minima-rpc' || config.mode === 'composite';
}
