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
import { ReplayGuard, NodeIdentity } from './auth-verify.js';
import { SessionTicketStore } from './ticket-store.js';
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
  /** RFC-032: node-wide anti-replay guard (per-identity nonce monotonicity). */
  readonly replayGuard = new ReplayGuard();
  /** RFC-032-A: issued session tickets (lifetime, budget, seq replay). */
  readonly tickets = new SessionTicketStore();
  /** Lazily-built node WOTS identity (TreeKey derivation is expensive). */
  private _nodeIdentity?: NodeIdentity;
  /** RFC-032-A: persisted node-identity use counter, restored in start(). */
  private _restoredIdentityUses = 0;

  private readonly _sessions = new Map<string, ClientSession>();
  /** RFC-020 H11: per-identity rate counter that survives reconnects. */
  private readonly _identityRpm = new Map<string, { count: number; windowStart: number }>();
  private _started = false;

  constructor(config: LookupNodeConfig) {
    this.config = config;
    this.provider = config.provider;
    this.nodeId = config.nodeId ?? `node-${Math.random().toString(36).slice(2)}`;

    // SQLite store — always on (defaults to ':memory:' for lightweight/test deployments)
    const dbPath = config.sqlite?.dbPath ?? ':memory:';
    this.store = new SqliteStore(dbPath);

    // RFC-032-A: the node identity is built lazily (TreeKey derivation is
    // expensive) on first ticket minting. Its WOTS use counter is persisted to
    // SQLite after every ticket signature and restored forward-only in start(),
    // so a restart can never re-use a ticket-signing leaf.

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
      this.trustIndex = new TrustIndex(this.store, config.trustIndex);
    }
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async start(): Promise<void> {
    if (this._started) return;
    this._started = true;

    // RFC-032-A: restore the node identity's WOTS use counter forward-only so a
    // restart cannot re-use a ticket-signing leaf. A caller-supplied
    // `nodeIdentityUses` wins; otherwise fall back to the persisted value.
    if (this.config.nodeIdentityUses !== undefined) {
      this._restoredIdentityUses = this.config.nodeIdentityUses;
    } else {
      const saved = this.store.kvGet('totem_lookup_node_identity_uses:v1');
      if (saved !== null) {
        const uses = Number.parseInt(saved, 10);
        if (Number.isSafeInteger(uses) && uses >= 0) this._restoredIdentityUses = uses;
      }
    }

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
    // RFC-020 H11: cap concurrent sessions so one peer cannot exhaust the node.
    const maxSessions = this.config.maxSessions ?? 64;
    if (this._sessions.size >= maxSessions) {
      try { transport.close(); } catch { /* ignore */ }
      throw new Error(`lookup-node: max concurrent sessions (${maxSessions}) reached`);
    }
    const session = new ClientSession(transport, this);
    this._sessions.set(session.sessionId, session);
    return session;
  }

  /**
   * RFC-020 H11: a fuzzy per-identity rate limit that survives reconnects. The
   * per-session counter reset whenever a client reconnected; this one is keyed
   * by authenticated public key for a rolling minute.
   */
  checkIdentityRate(publicKeyHex: string | undefined, rpm: number, now = Date.now()): boolean {
    if (!publicKeyHex) return true;
    const entry = this._identityRpm.get(publicKeyHex);
    if (!entry || now - entry.windowStart > 60_000) {
      this._identityRpm.set(publicKeyHex, { count: 1, windowStart: now });
      return true;
    }
    entry.count += 1;
    return entry.count <= rpm;
  }

  /** RFC-032-A: node WOTS identity (built lazily on first use). */
  get nodeIdentity(): NodeIdentity {
    if (!this._nodeIdentity) {
      this._nodeIdentity = NodeIdentity.fromNodeId(this.nodeId, this._restoredIdentityUses, (uses) => {
        try { this.store.kvSet('totem_lookup_node_identity_uses:v1', String(uses)); } catch { /* non-fatal */ }
      });
    }
    return this._nodeIdentity;
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
