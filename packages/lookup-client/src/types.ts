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
