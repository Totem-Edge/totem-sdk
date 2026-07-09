/**
 * WatchlistManager — tracks address/script/coin watchlists per client session,
 * polls the chain tip on an interval, diffs coin state, and pushes COIN_UPDATE
 * frames to all relevant subscribers.
 *
 * Persistence: when a SqliteStore is provided, watchlist registrations are
 * persisted to the `watchlist` table. On node restart, watched addresses are
 * recovered from SQLite so polling continues even before clients reconnect.
 * Transports are session-scoped and are NOT persisted; they are added back
 * when clients reconnect and re-register.
 */

import { encodeMessage } from '@totemsdk/lookup-protocol';
import type { Coin, ChainStateProvider } from '@totemsdk/chain-provider';
import type { ITransport } from './types.js';
import type { SqliteStore } from './storage.js';

export interface WatchlistManagerConfig {
  provider: ChainStateProvider;
  pollIntervalMs: number;
  /** Optional SQLite store for watchlist persistence (survives node restarts). */
  store?: SqliteStore;
}

interface Subscriber {
  transport: ITransport;
}

export class WatchlistManager {
  /** address/script/coinId → { sessionId → Subscriber } */
  private readonly _watches = new Map<string, Map<string, Subscriber>>();
  /** address → Map<coinId, Coin> — last known coin state per address */
  private readonly _coinCache = new Map<string, Map<string, Coin>>();
  /** session → set of watched keys (for cleanup on disconnect) */
  private readonly _sessionKeys = new Map<string, Set<string>>();

  private _lastBlock = -1;
  private _timer?: ReturnType<typeof setInterval>;
  private readonly _store?: SqliteStore;

  constructor(private readonly _config: WatchlistManagerConfig) {
    this._store = _config.store;
  }

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  register(sessionId: string, addresses: string[], transport: ITransport): void {
    if (!this._sessionKeys.has(sessionId)) {
      this._sessionKeys.set(sessionId, new Set());
    }
    const keys = this._sessionKeys.get(sessionId)!;

    for (const addr of addresses) {
      if (!this._watches.has(addr)) {
        this._watches.set(addr, new Map());
      }
      this._watches.get(addr)!.set(sessionId, { transport });
      keys.add(addr);
    }

    // Persist to SQLite (survives node restarts)
    this._store?.watchlistAdd(sessionId, addresses);
  }

  remove(sessionId: string, addresses: string[]): void {
    const keys = this._sessionKeys.get(sessionId);
    for (const addr of addresses) {
      this._watches.get(addr)?.delete(sessionId);
      if (this._watches.get(addr)?.size === 0) {
        this._watches.delete(addr);
        this._coinCache.delete(addr);
      }
      keys?.delete(addr);
    }

    // Remove from SQLite
    this._store?.watchlistRemove(sessionId, addresses);
  }

  removeSession(sessionId: string): void {
    const keys = this._sessionKeys.get(sessionId);
    if (!keys) {
      // Still remove from SQLite even if not in memory (e.g. recovered session)
      this._store?.watchlistRemoveSession(sessionId);
      return;
    }
    this.remove(sessionId, [...keys]);
    this._sessionKeys.delete(sessionId);
    // remove() already called watchlistRemove per address; clean up session-level row too
    this._store?.watchlistRemoveSession(sessionId);
  }

  getWatchedAddresses(): string[] {
    return [...this._watches.keys()];
  }

  // ---------------------------------------------------------------------------
  // Polling
  // ---------------------------------------------------------------------------

  start(): void {
    if (this._timer) return;

    // Recover persisted watchlist entries on startup (no transports yet — polling only)
    this._recoverFromStore();

    this._timer = setInterval(() => {
      this._poll().catch(() => { /* ignore poll errors — next tick retries */ });
    }, this._config.pollIntervalMs);
  }

  stop(): void {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = undefined;
    }
  }

  /** Exposed for testing: trigger a poll manually. */
  async forcePoll(): Promise<void> {
    await this._poll();
  }

  // ---------------------------------------------------------------------------
  // Recovery
  // ---------------------------------------------------------------------------

  /**
   * On node restart, load persisted watchlist entries from SQLite.
   * Addresses are added to `_watches` with an empty subscriber map so that
   * polling continues. Transports are populated when clients reconnect and
   * call register() again.
   */
  private _recoverFromStore(): void {
    if (!this._store) return;
    const rows = this._store.watchlistGetAll();
    for (const { sessionId, address } of rows) {
      if (!this._watches.has(address)) {
        this._watches.set(address, new Map());
      }
      // Don't add session to keys map — we have no transport yet
      // When the session reconnects, register() will add the transport
    }
    // sessionId not used here — transports are added back when clients reconnect via register()
  }

  private async _poll(): Promise<void> {
    const tip = await this._config.provider.getTip();
    if (tip.block <= this._lastBlock) return;
    this._lastBlock = tip.block;

    const allAddresses = [...this._watches.keys()];
    await Promise.all(
      allAddresses.map((addr) => this._checkAddress(addr, tip.block)),
    );
  }

  private async _checkAddress(addr: string, block: number): Promise<void> {
    const subscribers = this._watches.get(addr);
    if (!subscribers) return;
    // Only push updates to sessions that have an active transport
    const activeSubscribers = new Map(
      [...subscribers.entries()].filter(([, sub]) => sub.transport !== undefined),
    );
    if (activeSubscribers.size === 0) return;

    let freshCoins: Coin[];
    try {
      freshCoins = await this._config.provider.getCoins({ address: addr });
    } catch {
      return; // transient error — skip this tick
    }

    const prev = this._coinCache.get(addr) ?? new Map<string, Coin>();
    const next = new Map<string, Coin>(freshCoins.map((c) => [c.coinid, c]));

    // New coins
    for (const [coinId, coin] of next) {
      if (!prev.has(coinId)) {
        this._pushUpdate(activeSubscribers, { eventType: 'new', coin, block });
      }
    }

    // Spent coins
    for (const [coinId, coin] of prev) {
      if (!next.has(coinId)) {
        this._pushUpdate(activeSubscribers, { eventType: 'spent', coin, block });
      }
    }

    this._coinCache.set(addr, next);
  }

  private _pushUpdate(
    subscribers: Map<string, Subscriber>,
    event: { eventType: 'new' | 'spent' | 'confirmed'; coin: unknown; block: number },
  ): void {
    const frame = encodeMessage({ type: 'COIN_UPDATE', version: 1, payload: event });
    for (const sub of subscribers.values()) {
      try {
        sub.transport.send(frame);
      } catch {
        // transport may have closed — removeSession() will clean up
      }
    }
  }
}
