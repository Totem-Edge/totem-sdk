/**
 * @module @totemsdk/realtime
 * Types for real-time portfolio streaming
 */

// ---------------------------------------------------------------------------
// Shared PortfolioEntry — canonical balance type used everywhere
// ---------------------------------------------------------------------------

/**
 * A single portfolio entry representing one asset held at an address.
 *
 * kind classification:
 *   'native'  — tokenid === '0x00' (Minima)
 *   'nft'     — artimage present AND decimals === 0 AND total === '1'
 *   'token'   — everything else with a non-'0x00' tokenid
 */
export interface PortfolioEntry {
  kind: 'native' | 'token' | 'nft';
  tokenid: string;
  confirmed: string;
  unconfirmed: string;
  sendable: string;
  total: string;
  decimals: number;
  name: string;
  ticker: string;
  artimage?: string;
  webvalidate?: string;
  address: string;
  /** Number of UTXOs contributing to this balance */
  coins?: number;
  /** Token icon URL (may be a data URL or hosted URL) */
  icon?: string | null;
  /** Token website URL */
  url?: string | null;
  /** Token owner address */
  owner?: string | null;
  /** Token description */
  description?: string | null;
}

export type BackendUnsubscribe = () => void;

/**
 * Plug-in interface for the portfolio data source.
 *
 * Implement this to use any chain provider — LookupNode, a raw Minima RPC,
 * a custom indexer — instead of the default Axia hosted API.
 *
 * @example — sovereign LookupNode
 * ```ts
 * import { LookupBackend } from '@totemsdk/realtime';
 * import { connectLookupNode } from '@totemsdk/lookup-client';
 *
 * const client = await connectLookupNode({ hyperswarmTopic: 'abc...' });
 * const manager = createPortfolioStreamManager(deps, {
 *   backend: new LookupBackend(client),
 * });
 * ```
 *
 * @example — direct Minima node (polling)
 * ```ts
 * import { PureMinimaBackend } from '@totemsdk/realtime';
 * import { createPureMinimaClient } from '@totemsdk/pureminima-rpc';
 *
 * const rpc = createPureMinimaClient({ host: 'localhost', port: 9005 });
 * const manager = createPortfolioStreamManager(deps, {
 *   backend: new PureMinimaBackend(rpc),
 * });
 * ```
 */
export interface PortfolioBackend {
  /**
   * Whether this backend delivers push updates via `subscribe()`.
   * If false or absent the manager will call `getPortfolio()` on a timer.
   */
  readonly supportsPush?: boolean;

  /**
   * Fetch the current portfolio for one address.
   * Called for the initial snapshot and for poll cycles on non-push backends.
   */
  getPortfolio(address: string): Promise<PortfolioEntry[]>;

  /**
   * (Optional) Subscribe to real-time updates for a set of addresses.
   * Only called when `supportsPush` is true.
   * Must call `onUpdate(address, entries)` whenever the portfolio changes.
   * Returns an unsubscribe function to clean up listeners and watches.
   */
  subscribe?(
    addresses: string[],
    onUpdate: (address: string, entries: PortfolioEntry[]) => void,
  ): Promise<BackendUnsubscribe>;
}

// ---------------------------------------------------------------------------

export interface PortfolioUpdateEvent {
  version: string;
  timestamp: number;
  eventId: string;
  type: 'portfolio_update';
  address: string;
  entries: PortfolioEntry[];
}

export interface TxConfirmationEvent {
  version: string;
  timestamp: number;
  eventId: string;
  type: 'tx_confirmation';
  txid: string;
  address: string;
  confirmations: number;
  status: string;
  block: number;
  amount: string;
  tokenid: string;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error' | 'fallback';

export interface PortfolioStreamListener {
  onPortfolioUpdate(event: PortfolioUpdateEvent): void;
  onTxConfirmation?: (event: TxConfirmationEvent) => void;
  onConnectionStateChange?: (state: ConnectionState, error?: string) => void;
}

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export interface PortfolioStreamConfig {
  /**
   * Axia API base URL. Required when using the default Axia backend.
   * Omit when providing a custom `backend`.
   */
  baseUrl?: string;
  /**
   * Axia project ID sent as `x-api-key`. Required for the default Axia backend.
   * Omit when providing a custom `backend`.
   */
  projectId?: string;
  /**
   * Optional custom backend. When set, all Axia HTTP/WS logic is bypassed.
   * See `PortfolioBackend` for the interface.
   */
  backend?: PortfolioBackend;
  reconnectDelays?: number[];
  httpPollInterval?: number;
  tokenRefreshBuffer?: number;
  maxCacheAge?: number;
}

export interface WebSocketTokenResponse {
  token: string;
  sessionId: string;
  expiresAt?: number;
}
