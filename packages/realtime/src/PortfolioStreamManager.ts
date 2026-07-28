/**
 * Portfolio Stream Manager
 *
 * Platform-agnostic WebSocket client for real-time portfolio streaming.
 * Uses injected adapters for WebSocket, HTTP, storage, and timers so the
 * same class runs in browsers, Node.js, and Deno without modification.
 *
 * Replaces the legacy MegBalanceStreamManager with a unified PortfolioEntry API.
 *
 * Features:
 * - Single shared WebSocket connection to /v1/wallet/balance/ws
 * - JWT token management with auto-refresh
 * - Auto-reconnect with exponential backoff
 * - Portfolio caching per address (PortfolioCache)
 * - HTTP polling fallback via GET /v1/portfolio/:address
 *
 * Auth note: the Axia API's /v1/wallet/* routes currently accept
 * projectId "totem-shared". dApp developers using their own project IDs
 * must use the /v1/:projectId/* credit-gated routes instead.
 */

import type {
  WebSocketFactory,
  WebSocketClient,
  HttpClient,
  LoggerAdapter,
  TimerAdapter,
  TimerHandle,
  LifecycleAdapter,
} from '@totemsdk/core';
import { WebSocketReadyState } from '@totemsdk/core';
import { PortfolioCache, type PortfolioCacheDependencies, type PortfolioCacheConfig } from './PortfolioCache.js';
import type {
  PortfolioEntry,
  PortfolioBackend,
  PortfolioUpdateEvent,
  TxConfirmationEvent,
  ConnectionState,
  PortfolioStreamListener,
  PortfolioStreamConfig,
  WebSocketMessage,
} from './types.js';
import { toPortfolioEntry } from './normalize.js';

const DEFAULT_RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000];
const DEFAULT_HTTP_POLL_INTERVAL = 10000;
const DEFAULT_TOKEN_REFRESH_BUFFER = 5 * 60 * 1000; // 5 min before expiry

export interface PortfolioStreamDependencies {
  websocket: WebSocketFactory;
  http: HttpClient;
  logger: LoggerAdapter;
  timer: TimerAdapter;
  portfolioCache: PortfolioCache;
  lifecycle?: LifecycleAdapter;
}

/** Resolved (all-required) internal config shape for PortfolioStreamManager. */
interface ResolvedPortfolioStreamConfig {
  baseUrl: string;
  projectId: string;
  backend?: PortfolioBackend;
  reconnectDelays: number[];
  httpPollInterval: number;
  tokenRefreshBuffer: number;
  maxCacheAge: number;
}

export class PortfolioStreamManager {
  private readonly websocket: WebSocketFactory;
  private readonly http: HttpClient;
  private readonly logger: LoggerAdapter;
  private readonly timer: TimerAdapter;
  private readonly portfolioCache: PortfolioCache;

  private readonly config: ResolvedPortfolioStreamConfig;

  private ws: WebSocketClient | null = null;
  private wsToken: string | null = null;
  private wsTokenExpiry: number | null = null;
  private reconnectAttempts = 0;
  private reconnectTimeout: TimerHandle | null = null;
  private httpPollInterval: TimerHandle | null = null;
  private tokenRefreshTimeout: TimerHandle | null = null;
  private backendUnsubscribe: (() => void) | null = null;
  private subscribedAddresses: string[] = [];
  private listeners: Set<PortfolioStreamListener> = new Set();
  private connectionState: ConnectionState = 'disconnected';
  private lastError: string | undefined;
  private seenEventIds: Set<string> = new Set();
  private isSuspending = false;
  private cleanupSuspendHandler?: () => void;
  private cleanupResumeHandler?: () => void;
  private wasStarted = false;
  private savedAddresses: string[] = [];
  private isStreaming = false;
  private lastForceRefreshAt = 0;

  constructor(
    deps: PortfolioStreamDependencies,
    config: PortfolioStreamConfig
  ) {
    this.websocket = deps.websocket;
    this.http = deps.http;
    this.logger = deps.logger;
    this.timer = deps.timer;
    this.portfolioCache = deps.portfolioCache;

    this.config = {
      baseUrl: config.baseUrl ?? '',
      projectId: config.projectId ?? '',
      backend: config.backend,
      reconnectDelays: config.reconnectDelays ?? DEFAULT_RECONNECT_DELAYS,
      httpPollInterval: config.httpPollInterval ?? DEFAULT_HTTP_POLL_INTERVAL,
      tokenRefreshBuffer: config.tokenRefreshBuffer ?? DEFAULT_TOKEN_REFRESH_BUFFER,
      maxCacheAge: config.maxCacheAge ?? 24 * 60 * 60 * 1000,
    };

    if (deps.lifecycle) {
      this.cleanupSuspendHandler = deps.lifecycle.onSuspend(() => {
        this.logger.info('[PortfolioStream] Service worker suspending, cleaning up...');
        this.isSuspending = true;
        this.savedAddresses = [...this.subscribedAddresses];
        this.wasStarted = this.connectionState !== 'disconnected';
        this.cleanupInternal();
      });

      if (deps.lifecycle.onResume) {
        this.cleanupResumeHandler = deps.lifecycle.onResume(() => {
          this.logger.info('[PortfolioStream] Service worker resuming...');
          this.isSuspending = false;

          if (this.wasStarted && this.savedAddresses.length > 0) {
            this.logger.info('[PortfolioStream] Restoring subscriptions for', this.savedAddresses.length, 'addresses');
            this.start(this.savedAddresses).catch(error => {
              this.logger.error('[PortfolioStream] Failed to restore subscriptions on resume:', error);
            });
          }
        });
      }
    }
  }

  private cleanupInternal(): void {
    this.stopHttpFallback();
    this.clearTokenRefresh();
    this.clearReconnectTimeout();
    this.disconnectWebSocket();
    if (this.backendUnsubscribe) {
      try { this.backendUnsubscribe(); } catch { /* ignore */ }
      this.backendUnsubscribe = null;
    }

    this.wsToken = null;
    this.wsTokenExpiry = null;
    this.reconnectAttempts = 0;
    this.seenEventIds.clear();
  }

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      this.timer.clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  addListener(listener: PortfolioStreamListener): void {
    this.listeners.add(listener);
  }

  removeListener(listener: PortfolioStreamListener): void {
    this.listeners.delete(listener);
  }

  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  isCurrentlyStreaming(): boolean {
    return this.isStreaming;
  }

  async getCachedPortfolio(address: string): Promise<PortfolioEntry[] | null> {
    return this.portfolioCache.get(address);
  }

  /**
   * Get a snapshot of cached portfolios for a set of addresses.
   */
  async getSnapshot(addresses?: string[]): Promise<{
    portfolios: Record<string, PortfolioEntry[]>;
    connectionState: ConnectionState;
    error?: string;
  }> {
    const portfolios: Record<string, PortfolioEntry[]> = {};
    const addressesToCheck = addresses ?? this.subscribedAddresses;

    for (const address of addressesToCheck) {
      const cached = await this.portfolioCache.get(address);
      if (cached) portfolios[address] = cached;
    }

    return { portfolios, connectionState: this.connectionState, error: this.lastError };
  }

  /**
   * Replay the current cache to all listeners without triggering a new subscription.
   */
  async triggerReplay(): Promise<void> {
    this.logger.info('[PortfolioStream] triggerReplay: replaying cache to all listeners');
    for (const address of this.subscribedAddresses) {
      const entries = await this.portfolioCache.get(address);
      if (entries) {
        this._emitPortfolioUpdate(address, entries, `replay-${this.timer.now()}`);
      }
    }
  }

  /**
   * Force an immediate HTTP portfolio fetch.
   * Rate-limited to once every 5 seconds.
   */
  async forceRefresh(): Promise<void> {
    const now = this.timer.now();
    if (now - this.lastForceRefreshAt < 5_000) return;
    this.lastForceRefreshAt = now;
    this.logger.info('[PortfolioStream] forceRefresh: triggering HTTP portfolio fetch');
    await this.pollPortfolios();
  }

  async start(addresses: string[]): Promise<void> {
    this.logger.info('[PortfolioStream] Starting for addresses:', addresses);

    this.subscribedAddresses = addresses;
    this.isSuspending = false;
    this.isStreaming = true;

    const backend = this.config.backend;
    if (backend) {
      if (backend.supportsPush && typeof backend.subscribe === 'function') {
        try {
          this.setConnectionState('connecting');
          this.backendUnsubscribe = await backend.subscribe(
            addresses,
            (address, entries) => this._handleBackendUpdate(address, entries, 'websocket'),
          );
          for (const address of addresses) {
            try {
              const entries = await backend.getPortfolio(address);
              this._handleBackendUpdate(address, entries, 'websocket');
            } catch (e) {
              this.logger.warn(`[PortfolioStream] Backend snapshot failed for ${address}:`, e);
            }
          }
          this.setConnectionState('connected');
        } catch (error) {
          this.logger.error('[PortfolioStream] Backend push setup failed, falling back to polling:', error);
          this.startHttpFallback();
        }
      } else {
        this.startHttpFallback();
      }
      return;
    }

    try {
      await this.connectWebSocket();
    } catch (error) {
      this.logger.error('[PortfolioStream] WebSocket connection failed, falling back to HTTP:', error);
      this.startHttpFallback();
    }
  }

  stop(): void {
    this.logger.info('[PortfolioStream] Stopping');

    this.isStreaming = false;
    this.cleanupInternal();
    this.subscribedAddresses = [];
    this.setConnectionState('disconnected');
  }

  dispose(): void {
    this.stop();
    if (this.cleanupSuspendHandler) this.cleanupSuspendHandler();
    if (this.cleanupResumeHandler) this.cleanupResumeHandler();
    this.wasStarted = false;
    this.savedAddresses = [];
    this.websocket.dispose();
  }

  async updateAddresses(addresses: string[]): Promise<void> {
    this.subscribedAddresses = addresses;

    if (this.ws && this.ws.readyState === WebSocketReadyState.OPEN && this.connectionState === 'connected') {
      this.ws.send(JSON.stringify({ type: 'unsubscribe' }));
      this.sendSubscribe();
    }
  }

  private setConnectionState(state: ConnectionState, error?: string): void {
    if (this.connectionState !== state) {
      this.connectionState = state;
      this.lastError = error;

      this.logger.info(`[PortfolioStream] Connection state: ${state}${error ? ` (${error})` : ''}`);

      for (const listener of this.listeners) {
        listener.onConnectionStateChange?.(state, error);
      }
    }
  }

  private async fetchWebSocketToken(): Promise<string> {
    const tokenUrl = `${this.config.baseUrl}/v1/wallet/ws-token`;

    this.logger.debug('[PortfolioStream] Fetching WebSocket token from:', tokenUrl);

    const response = await this.http.post<{ token: string; sessionId: string }>(
      tokenUrl,
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.projectId,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch WebSocket token: ${response.status} ${response.statusText}`);
    }

    this.wsToken = response.data.token;
    this.wsTokenExpiry = this.timer.now() + 24 * 60 * 60 * 1000;

    this.scheduleTokenRefresh();

    this.logger.debug('[PortfolioStream] WebSocket token acquired, sessionId:', response.data.sessionId);

    return response.data.token;
  }

  private scheduleTokenRefresh(): void {
    this.clearTokenRefresh();

    if (!this.wsTokenExpiry) return;

    const refreshIn = this.wsTokenExpiry - this.timer.now() - this.config.tokenRefreshBuffer;

    if (refreshIn > 0) {
      this.tokenRefreshTimeout = this.timer.setTimeout(async () => {
        try {
          this.logger.info('[PortfolioStream] Refreshing token before expiry');
          await this.fetchWebSocketToken();

          if (this.ws && this.ws.readyState === WebSocketReadyState.OPEN) {
            this.disconnectWebSocket();
            await this.connectWebSocket();
          }
        } catch (error) {
          this.logger.error('[PortfolioStream] Token refresh failed:', error);
        }
      }, refreshIn);
    }
  }

  private clearTokenRefresh(): void {
    if (this.tokenRefreshTimeout) {
      this.timer.clearTimeout(this.tokenRefreshTimeout);
      this.tokenRefreshTimeout = null;
    }
  }

  private async connectWebSocket(): Promise<void> {
    this.setConnectionState('connecting');

    try {
      if (!this.wsToken || (this.wsTokenExpiry && this.timer.now() >= this.wsTokenExpiry)) {
        await this.fetchWebSocketToken();
      }

      const wsProtocol = this.config.baseUrl.startsWith('https') ? 'wss:' : 'ws:';
      const host = new URL(this.config.baseUrl).host;
      const wsUrl = `${wsProtocol}//${host}/v1/wallet/balance/ws?token=${this.wsToken}`;

      this.logger.debug('[PortfolioStream] Connecting to WebSocket:', wsUrl.substring(0, 50) + '...');

      return new Promise((resolve, reject) => {
        this.ws = this.websocket.create(wsUrl);

        const onOpen = () => {
          this.logger.debug('[PortfolioStream] WebSocket connected');
          this.reconnectAttempts = 0;
        };

        const onMessage = (event: { data: string | ArrayBuffer | Uint8Array }) => {
          try {
            const data = typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data as ArrayBuffer);
            const msg: WebSocketMessage = JSON.parse(data);
            this.handleMessage(msg, resolve);
          } catch (error) {
            this.logger.error('[PortfolioStream] Failed to parse message:', error);
          }
        };

        const onError = (event: { message?: string; error?: Error }) => {
          this.logger.error('[PortfolioStream] WebSocket error:', event.message || event.error);
          this.setConnectionState('error', 'Connection error');
          reject(new Error('WebSocket connection error'));
        };

        const onClose = (event: { code: number; reason: string }) => {
          this.logger.info('[PortfolioStream] WebSocket closed:', event.code, event.reason);

          this.ws = null;

          if (event.code === 1008) {
            this.setConnectionState('error', event.reason || 'Policy violation');
            this.startHttpFallback();
          } else if (event.code !== 1000) {
            this.scheduleReconnect();
          } else {
            this.setConnectionState('disconnected');
          }
        };

        this.ws.addEventListener('open', onOpen);
        this.ws.addEventListener('message', onMessage);
        this.ws.addEventListener('error', onError);
        this.ws.addEventListener('close', onClose);

        this.timer.setTimeout(() => {
          if (this.connectionState === 'connecting') {
            reject(new Error('Connection timeout'));
            this.ws?.close();
          }
        }, 10000);
      });
    } catch (error) {
      this.setConnectionState('error', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  private handleMessage(msg: WebSocketMessage, onConnected?: () => void): void {
    switch (msg.type) {
      case 'authenticated':
        this.logger.debug('[PortfolioStream] Authenticated:', msg.userId);
        this.setConnectionState('connected');
        this.sendSubscribe();
        onConnected?.();
        break;

      case 'subscribed':
        this.logger.debug('[PortfolioStream] Subscribed:', msg.subscription_id ?? msg.subscriptionId);
        break;

      case 'capabilities':
        this.logger.debug('[PortfolioStream] Server capabilities:', msg.features);
        break;

      /**
       * portfolio_snapshot — sent immediately after subscribe.
       * Shape: { type:'portfolio_snapshot', entries: PortfolioEntry[], change_seq, tip_height, ... }
       */
      case 'portfolio_snapshot': {
        const entries: PortfolioEntry[] = msg.entries ?? [];
        const now = this.timer.now();

        // Group entries by address and cache them
        const byAddress = new Map<string, PortfolioEntry[]>();
        for (const entry of entries) {
          const addr = entry.address;
          if (!byAddress.has(addr)) byAddress.set(addr, []);
          byAddress.get(addr)!.push(entry);
        }

        for (const [address, addrEntries] of byAddress) {
          void this.portfolioCache.set(address, addrEntries);
          this._emitPortfolioUpdate(
            address,
            addrEntries,
            `snapshot-${now}-${address.substring(0, 8)}`,
          );
        }

        // For any subscribed address that the server omitted from the snapshot,
        // poll HTTP once to confirm before accepting zero as the balance.
        // This prevents a transient WS RPC failure from permanently displaying
        // 0 MIN for a funded wallet.
        for (const addr of this.subscribedAddresses) {
          if (!byAddress.has(addr)) {
            this._pollAddressOnce(addr).catch(err =>
              this.logger.warn('[PortfolioStream] One-shot poll failed for', addr, err),
            );
          }
        }

        this.logger.debug('[PortfolioStream] portfolio_snapshot applied:', entries.length, 'entries');
        break;
      }

      /**
       * portfolio_delta — sent after each UTXO delta with updated entries.
       * Shape: { type:'portfolio_delta', changes: PortfolioEntry[], ... }
       */
      case 'portfolio_delta': {
        const changes: PortfolioEntry[] = msg.changes ?? [];
        const now = this.timer.now();

        const byAddress = new Map<string, PortfolioEntry[]>();
        for (const entry of changes) {
          if (!byAddress.has(entry.address)) byAddress.set(entry.address, []);
          byAddress.get(entry.address)!.push(entry);
        }

        // Merge delta entries INTO the existing cached portfolio by tokenid.
        // This prevents unaffected tokens from disappearing when a partial
        // delta arrives (e.g. only native Minima balance changed).
        (async () => {
          for (const [address, addrChanges] of byAddress) {
            const existing = (await this.portfolioCache.get(address)) ?? [];
            const changedIds = new Set(addrChanges.map(e => e.tokenid));
            const merged = [
              ...existing.filter(e => !changedIds.has(e.tokenid)),
              ...addrChanges,
            ];
            await this.portfolioCache.set(address, merged);
            this._emitPortfolioUpdate(
              address,
              merged,
              `delta-${now}-${address.substring(0, 8)}`,
            );
          }
        })().catch(err =>
          this.logger.error('[PortfolioStream] portfolio_delta merge error:', err),
        );
        break;
      }

      case 'delta_batch':
        this.logger.debug('[PortfolioStream] delta_batch received, batch_seq=', msg.batch_seq);
        break;

      case 'resync_required':
        this.logger.info('[PortfolioStream] resync_required received, reason=', msg.reason, '— reconnecting');
        this.disconnectWebSocket();
        this.scheduleReconnect();
        break;

      case 'tx_confirmation':
        this.handleTxConfirmation(msg.event as TxConfirmationEvent);
        break;

      case 'ping':
        this.ws?.send(JSON.stringify({ type: 'pong' }));
        break;

      case 'error':
        this.logger.error('[PortfolioStream] Server error:', msg.message, 'code:', msg.code);
        // If the server reports it couldn't fetch some addresses, poll HTTP for those
        // rather than silently displaying 0.
        if ((msg.code === 'snapshot_failed' || msg.code === 'snapshot_internal_error') && Array.isArray(msg.addresses) && msg.addresses.length > 0) {
          for (const addr of msg.addresses) {
            this._pollAddressOnce(addr).catch(err =>
              this.logger.warn('[PortfolioStream] One-shot poll for error frame failed for', addr, err),
            );
          }
        } else if (msg.code === 'snapshot_internal_error') {
          // Full snapshot failure — poll all subscribed addresses
          for (const addr of this.subscribedAddresses) {
            this._pollAddressOnce(addr).catch(err =>
              this.logger.warn('[PortfolioStream] One-shot poll (internal error) failed for', addr, err),
            );
          }
        }
        break;

      default:
        this.logger.debug('[PortfolioStream] Unknown message type:', msg.type);
    }
  }

  private _emitPortfolioUpdate(address: string, entries: PortfolioEntry[], eventId: string): void {
    const event: PortfolioUpdateEvent = {
      version: '3.0',
      timestamp: this.timer.now(),
      eventId,
      type: 'portfolio_update',
      address,
      entries,
    };

    for (const listener of this.listeners) {
      try { listener.onPortfolioUpdate(event); } catch (e) {
        this.logger.error('[PortfolioStream] Listener error:', e);
      }
    }
  }

  private sendSubscribe(): void {
    if (!this.ws || this.ws.readyState !== WebSocketReadyState.OPEN) return;
    if (this.subscribedAddresses.length === 0) return;

    this.ws.send(JSON.stringify({
      type: 'subscribe',
      filter: {
        addresses: this.subscribedAddresses,
      },
    }));
  }

  private handleTxConfirmation(event: TxConfirmationEvent): void {
    if (this.seenEventIds.has(event.eventId)) return;
    this.seenEventIds.add(event.eventId);

    for (const listener of this.listeners) {
      try {
        listener.onTxConfirmation?.(event);
      } catch (error) {
        this.logger.error('[PortfolioStream] Listener error:', error);
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.isSuspending) {
      this.logger.info('[PortfolioStream] Skipping reconnect, service worker is suspending');
      return;
    }

    this.clearReconnectTimeout();

    const delays = this.config.reconnectDelays;
    const delay = delays[Math.min(this.reconnectAttempts, delays.length - 1)];
    this.reconnectAttempts++;

    this.logger.info(`[PortfolioStream] Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this.setConnectionState('connecting');

    this.reconnectTimeout = this.timer.setTimeout(async () => {
      this.reconnectTimeout = null;

      try {
        this.stopHttpFallback();
        await this.connectWebSocket();
      } catch (error) {
        this.logger.error('[PortfolioStream] Reconnect failed:', error);

        if (this.reconnectAttempts >= delays.length) {
          this.logger.info('[PortfolioStream] Max reconnect attempts reached, falling back to HTTP');
          this.startHttpFallback();
        } else {
          this.scheduleReconnect();
        }
      }
    }, delay);
  }

  private disconnectWebSocket(): void {
    this.clearReconnectTimeout();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }

  /**
   * One-shot HTTP poll for a single address.
   * Used when the WS snapshot omits an address (RPC failure) so we don't
   * permanently display 0 MIN for a funded wallet.
   *
   * Zero is emitted ONLY when the HTTP response is successful AND confirms no
   * UTXOs (response.ok && entries.length === 0).  Any transport failure or
   * non-OK HTTP status means we cannot confirm zero — in that case the HTTP
   * fallback polling loop is started so the request retries on an interval.
   */
  private async _pollAddressOnce(address: string): Promise<void> {
    const backend = this.config.backend;

    if (backend) {
      try {
        const entries = await backend.getPortfolio(address);
        void this.portfolioCache.set(address, entries);
        this._emitPortfolioUpdate(
          address,
          entries,
          `snapshot-poll-${this.timer.now()}-${address.substring(0, 8)}`,
        );
      } catch {
        // Backend fetch failed — do NOT commit zero; activate the HTTP fallback
        // loop so it retries for all subscribed addresses.
        this.logger.warn('[PortfolioStream] One-shot backend poll failed for', address, '— activating HTTP fallback');
        if (!this.httpPollInterval) this.startHttpFallback();
      }
      return;
    }

    // Default path: GET /v1/:projectId/portfolio/:address
    try {
      const url = `${this.config.baseUrl}/v1/${encodeURIComponent(this.config.projectId)}/portfolio/${encodeURIComponent(address)}`;
      const response = await this.http.get<{ success?: boolean; entries?: any[] }>(url, {
        headers: { 'x-api-key': this.config.projectId },
      });

      if (!response.ok) {
        // Non-OK HTTP response — server error; do NOT commit zero.
        // Start the fallback polling loop to retry.
        this.logger.warn('[PortfolioStream] One-shot HTTP poll non-OK for', address, '— activating HTTP fallback');
        if (!this.httpPollInterval) this.startHttpFallback();
        return;
      }

      const entries: PortfolioEntry[] = (response.data.entries && Array.isArray(response.data.entries))
        ? response.data.entries
        : [];

      if (entries.length > 0) {
        // HTTP confirmed balance — cache and emit it
        void this.portfolioCache.set(address, entries);
        this._emitPortfolioUpdate(
          address,
          entries,
          `snapshot-poll-${this.timer.now()}-${address.substring(0, 8)}`,
        );
      } else {
        // HTTP confirmed no UTXOs for this address — safe to emit zero
        this._emitZeroEntry(address);
      }
    } catch {
      // Network/transport failure — do NOT commit zero.
      // Activate the fallback loop so the request retries.
      this.logger.warn('[PortfolioStream] One-shot HTTP poll threw for', address, '— activating HTTP fallback');
      if (!this.httpPollInterval) this.startHttpFallback();
    }
  }

  /** Emit a zero-balance native entry for an address that has no on-chain UTXOs. */
  private _emitZeroEntry(address: string): void {
    const zeroEntry: PortfolioEntry = {
      kind: 'native',
      tokenid: '0x00',
      confirmed: '0',
      unconfirmed: '0',
      sendable: '0',
      total: '0',
      decimals: 4,
      name: 'Minima',
      ticker: 'MINIMA',
      address,
      coins: 0,
    };
    void this.portfolioCache.set(address, [zeroEntry]);
    this._emitPortfolioUpdate(
      address,
      [zeroEntry],
      `snapshot-zero-${this.timer.now()}-${address.substring(0, 8)}`,
    );
  }

  private _handleBackendUpdate(
    address: string,
    entries: PortfolioEntry[],
    source: 'websocket' | 'http',
  ): void {
    const eventId = `backend-${source}-${this.timer.now()}-${address.substring(0, 8)}`;
    void this.portfolioCache.set(address, entries);
    this._emitPortfolioUpdate(address, entries, eventId);
  }

  private startHttpFallback(): void {
    if (this.httpPollInterval) return;

    this.logger.info('[PortfolioStream] Starting HTTP fallback polling');
    this.setConnectionState('fallback');

    this.pollPortfolios();

    this.httpPollInterval = this.timer.setInterval(() => {
      this.pollPortfolios();
    }, this.config.httpPollInterval);
  }

  private stopHttpFallback(): void {
    if (this.httpPollInterval) {
      this.timer.clearInterval(this.httpPollInterval);
      this.httpPollInterval = null;
    }
  }

  private async pollPortfolios(): Promise<void> {
    if (this.subscribedAddresses.length === 0) return;

    const backend = this.config.backend;
    if (backend) {
      for (const address of this.subscribedAddresses) {
        try {
          const entries = await backend.getPortfolio(address);
          this._handleBackendUpdate(address, entries, 'http');
        } catch (error) {
          this.logger.error(`[PortfolioStream] Backend poll failed for ${address}:`, error);
        }
      }
      return;
    }

    // Default path: GET /v1/:projectId/portfolio/:address
    for (const address of this.subscribedAddresses) {
      try {
        const url = `${this.config.baseUrl}/v1/${encodeURIComponent(this.config.projectId)}/portfolio/${encodeURIComponent(address)}`;
        const response = await this.http.get<{
          success: boolean;
          entries?: any[];
        }>(url, {
          headers: {
            'x-api-key': this.config.projectId,
          },
        });

        if (!response.ok) continue;

        const data = response.data;
        let entries: PortfolioEntry[] = [];

        if (data.entries && Array.isArray(data.entries)) {
          entries = data.entries;
        }

        this._handleBackendUpdate(address, entries, 'http');
      } catch (error) {
        this.logger.error(`[PortfolioStream] HTTP poll failed for ${address}:`, error);
      }
    }
  }
}

export function createPortfolioStreamManager(
  deps: Omit<PortfolioStreamDependencies, 'portfolioCache'> & {
    storage: import('@totemsdk/core').StorageAdapter;
  },
  config: PortfolioStreamConfig
): PortfolioStreamManager {
  const portfolioCache = new PortfolioCache(
    {
      storage: deps.storage,
      logger: deps.logger,
      timer: deps.timer,
    },
    { maxCacheAge: config.maxCacheAge }
  );

  return new PortfolioStreamManager(
    {
      websocket: deps.websocket,
      http: deps.http,
      logger: deps.logger,
      timer: deps.timer,
      portfolioCache,
      lifecycle: deps.lifecycle,
    },
    config
  );
}
