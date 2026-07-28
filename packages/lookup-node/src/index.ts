/**
 * @totemsdk/lookup-node — public API
 */

export { LookupNode } from './node.js';
export { SqliteStore, SqliteStorageAdapter } from './storage.js';
export { WatchlistManager } from './watchlist.js';
export { TxPoWRelay } from './relay.js';
export { LeaseCoordinator } from './lease.js';
export { AppRegistry, AgentRegistry } from './registry.js';
export { TrustIndex } from './trust.js';
export { HyperswarmManager, HyperswarmTransport } from './hyperswarm-manager.js';
export type { HyperswarmManagerConfig } from './hyperswarm-manager.js';

export type {
  LookupNodeConfig,
  ITransport,
  RelayConfig,
  LeaseConfig,
  AppRegistryConfig,
  AgentRegistryConfig,
  TrustIndexConfig,
  SqliteConfig,
  MegaMMRConfig,
} from './types.js';
export type { NodeDispatcher } from './session.js';
export type { AppRow, AgentRow, TrustRow } from './storage.js';

/**
 * Create and return a LookupNode (not yet started).
 * Call `node.start()` to begin polling and accepting connections.
 */
import { LookupNode } from './node.js';
import type { LookupNodeConfig } from './types.js';

export function createLookupNode(config: LookupNodeConfig): LookupNode {
  return new LookupNode(config);
}
