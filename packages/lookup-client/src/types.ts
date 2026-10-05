/**
 * @totemsdk/lookup-client — shared types
 */

export type { IStreamTransport } from '@totemsdk/stream-transport';

/**
 * Transport abstraction over any duplex byte stream.
 * Alias for IStreamTransport — kept for backward compatibility.
 */
export type { IStreamTransport as ITransport } from '@totemsdk/stream-transport';

export interface LookupClientConfig {
  /** Hex-encoded 32-byte Hyperswarm topic key (64 hex chars). Primary P2P transport. */
  hyperswarmTopic?: string;
  /** Direct HTTP/WS URL fallback — used when Hyperswarm is unavailable.
   *  The client will convert http(s):// to ws(s):// automatically. */
  nodeUrl?: string;
  /** Per-request timeout in milliseconds. Default: 10_000. */
  timeoutMs?: number;
  /** Initial reconnect backoff delay in ms. Default: 1_000. */
  reconnectBaseMs?: number;
  /** Maximum reconnect backoff delay in ms. Default: 30_000. */
  reconnectMaxMs?: number;
  /**
   * RFC-032: 32-byte seed for the post-quantum (WOTS/TreeKey) lookup identity.
   * Defaults to an all-zero seed for tests; production callers should derive
   * this from `@totemsdk/root-identity`. Ignored when `identity` is provided.
   */
  identitySeed?: Uint8Array;
  /** RFC-032: pre-built identity (takes precedence over `identitySeed`). */
  identity?: import('./identity.js').LookupIdentity;
  /**
   * RFC-032 §9 Q1: use a `@totemsdk/root-identity` `UnifiedIdentityWallet` as the
   * lookup identity (its root key by default). Takes precedence over
   * `identitySeed` but not over `identity`. Persist the wallet's watermark so
   * the one-time counter survives restarts.
   */
  identityWallet?: import('@totemsdk/root-identity').UnifiedIdentityWallet;
  /** RFC-032: wallet slot (`'root'` or child index). Default `'root'`. */
  identitySlot?: import('./identity.js').IdentitySlot;
  /** RFC-032: identity derivation options (address index, resume uses). */
  identityOptions?: import('./identity.js').LookupIdentityOptions;
  /** RFC-032: auth envelope TTL in ms. Default 60_000. */
  authTtlMs?: number;
  /** RFC-032: optional root-identity proof binding (verified by the node). */
  rootIdentityProof?: string;
  /** RFC-032: optional Minima address (trusted only when the proof verifies). */
  address?: string;
  /**
   * RFC-032-A: open a session on connect and reuse a node-issued ticket for
   * non-high-value messages (amortises WOTS use). Default false (per-message WOTS).
   */
  useSessionTickets?: boolean;
  /** RFC-032-A: requested session-ticket lifetime in ms (node clamps). */
  sessionTtlMs?: number;
  /** RFC-032-A: message types that must always carry a full WOTS envelope. */
  authRequiredTypes?: readonly string[];
  /**
   * @internal — factory called on every connection attempt (for testing).
   * Bypasses Hyperswarm/HTTP transport creation entirely.
   * When provided, _transport is ignored.
   */
  _transportFactory?: () => import('@totemsdk/stream-transport').IStreamTransport | Promise<import('@totemsdk/stream-transport').IStreamTransport>;
  /**
   * @internal — a single pre-connected ITransport (for testing, no reconnect).
   * Ignored when _transportFactory is set.
   */
  _transport?: import('@totemsdk/stream-transport').IStreamTransport;
}

export type Unsubscribe = () => void;

export interface CoinUpdateEvent {
  eventType: 'new' | 'spent' | 'confirmed';
  coin: unknown;
  block: number;
}

export type CoinUpdateCallback = (event: CoinUpdateEvent) => void;
