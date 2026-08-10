/**
 * @module @totemsdk/realtime
 * Real-time portfolio streaming with WebSocket and HTTP fallback
 *
 * Provides:
 * - PortfolioStreamManager: auto-reconnect streaming with HTTP fallback
 * - PortfolioCache: persistent portfolio caching with TTL
 * - PortfolioBackend: plug-in interface for custom chain providers
 * - LookupBackend: adapter for @totemsdk/lookup-client (sovereign P2P node)
 * - MinimaRpcBackend: adapter for @totemsdk/minima-rpc (direct node RPC, polling)
 * - createPortfolioStreamManager: factory for easy instantiation with adapters
 * - toPortfolioEntry: normalizer from raw balance shapes to PortfolioEntry
 */

export {
  PortfolioStreamManager,
  createPortfolioStreamManager,
  type PortfolioStreamDependencies,
} from './PortfolioStreamManager.js';

export {
  PortfolioCache,
  type PortfolioCacheDependencies,
  type PortfolioCacheConfig,
} from './PortfolioCache.js';

export { LookupBackend, type LookupLike } from './backends/LookupBackend.js';
export { MinimaRpcBackend, type MinimaRpcLike } from './backends/MinimaRpcBackend.js';

export { toPortfolioEntry, classifyKind, type RawBalanceEntry } from './normalize.js';

export type {
  PortfolioEntry,
  PortfolioUpdateEvent,
  TxConfirmationEvent,
  ConnectionState,
  PortfolioStreamListener,
  PortfolioStreamConfig,
  PortfolioBackend,
  BackendUnsubscribe,
  WebSocketMessage,
  WebSocketTokenResponse,
} from './types.js';
