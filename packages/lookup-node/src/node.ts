/**
 * LookupNode — wires all modules together and manages the connection lifecycle.
 *
 * Usage:
 *   const node = new LookupNode(config);
 *   await node.start();
 *   node.handleConnection(transport);  // called per Hyperswarm connection
 *   await node.stop();
 */

import { WatchlistManager } from './watchlist.js';
import { TxPoWRelay } from './relay.js';
import { LeaseCoordinator } from './lease.js';
import { AppRegistry, AgentRegistry } from './registry.js';
import { TrustIndex } from './trust.js';
import { ClientSession } from './session.js';
import { SqliteStore, SqliteStorageAdapter } from './storage.js';
import type { NodeDispatcher } from './session.js';
import type { ITransport, LookupNodeConfig, ChainStateProvider } from './types.js';

export class LookupNode implements NodeDispatcher {
  readonly config: LookupNodeConfig;
  readonly provider: ChainStateProvider;
  readonly store: SqliteStore;
  readonly watchlist: WatchlistManager;
  readonly relay?: TxPoWRelay;
  readonly lease?: LeaseCoordinator;
  readonly appRegistry?: AppRegistry;
  readonly agentRegistry?: AgentRegistry;
  readonly trustIndex?: TrustIndex;

  nodeId: string;

  private readonly _sessions = new Map<string, ClientSession>();
  private _started = false;

  constructor(config: LookupNodeConfig) {
    this.config = config;
    this.provider = config.provider;
    this.nodeId = config.nodeId ?? `node-${Math.random().toString(36).slice(2)}`;

    // SQLite store — always on (defaults to ':memory:' for lightweight/test deployments)
    const dbPath = config.sqlite?.dbPath ?? ':memory:';
    this.store = new SqliteStore(dbPath);

    // Watchlist uses the same store for address persistence
    this.watchlist = new WatchlistManager({
      provider: config.provider,
      pollIntervalMs: config.pollIntervalMs ?? 5_000,
      store: this.store,
    });

    if (config.relay?.enabled) {
      this.relay = new TxPoWRelay(config.provider, config.relay, this.store);
    }

    if (config.lease?.enabled) {
      // Default storage: SqliteStorageAdapter backed by the node's SqliteStore.
      // The durable kv_store table provides crash-safe lease journaling.
      const leaseStorage = config.lease.storage ?? new SqliteStorageAdapter(this.store);
      this.lease = new LeaseCoordinator(this.nodeId, {
        ...config.lease,
        storage: leaseStorage,
      });
    }

    if (config.appRegistry?.enabled) {
      this.appRegistry = new AppRegistry(
        this.store,
        config.appRegistry.requireSignature ?? false,
      );
    }

    if (config.agentRegistry?.enabled) {
      this.agentRegistry = new AgentRegistry(
        this.store,
        config.agentRegistry.requireSignature ?? false,
      );
    }

    if (config.trustIndex?.enabled) {
      this.trustIndex = new TrustIndex(this.store);
    }
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async start(): Promise<void> {
    if (this._started) return;
    this._started = true;

    if (this.lease) {
      await this.lease.initialize();
    }

    this.watchlist.start();

    if (this.agentRegistry && this.config.agentRegistry?.enabled) {
      const interval = this.config.agentRegistry.expiryCheckIntervalMs ?? 60_000;
      this.agentRegistry.startExpiryLoop(interval);
    }
  }

  async stop(): Promise<void> {
    this._started = false;
    this.watchlist.stop();
    this.agentRegistry?.stopExpiryLoop();
    this._sessions.clear();
    this.store.close();
  }

  // ---------------------------------------------------------------------------
  // Connection handling
  // ---------------------------------------------------------------------------

  /**
   * Register a new client connection.
   * In production: called for each Hyperswarm connection.
   * In tests: inject a TestTransport (see __tests__/helpers.ts).
   */
  handleConnection(transport: ITransport): ClientSession {
    const session = new ClientSession(transport, this);
    this._sessions.set(session.sessionId, session);
    return session;
  }

  onSessionClosed(sessionId: string): void {
    this._sessions.delete(sessionId);
  }

  // ---------------------------------------------------------------------------
  // Observability
  // ---------------------------------------------------------------------------

  get sessionCount(): number {
    return this._sessions.size;
  }

  getSessions(): ClientSession[] {
    return [...this._sessions.values()];
  }

  /**
   * Whether this node is running in MegaMMR/indexer mode.
   * When true, the provider is expected to support wider chain-state queries
   * such as full balance indexing and chain-wide analytics endpoints.
   * The provider's `getCoins()` may be called without an address filter to
   * retrieve all coins from the indexer.
   */
  get isMegaMMRMode(): boolean {
    return this.config.megammr?.enabled === true;
  }
}
