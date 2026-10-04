/**
 * LookupClient — the public API for @totemsdk/lookup-client.
 *
 * Combines transport + auth + rpc + subscriptions into a single handle.
 * Reconnects automatically with exponential backoff when the connection drops.
 */

import type {
  BroadcastResult,
  ChainTip,
  Coin,
  CoinsQuery,
  MMRProof,
  TokenInfo,
  TokenSearchQuery,
} from '@totemsdk/chain-provider';
import { PROTOCOL_VERSION } from '@totemsdk/lookup-protocol';
import { Authenticator, LookupIdentity } from './auth.js';
import { RpcLayer } from './rpc.js';
import { SubscriptionManager } from './subscriptions.js';
import { createHyperswarmTransport } from './transport.js';
import type { CoinUpdateCallback, ITransport, LookupClientConfig, Unsubscribe } from './types.js';

type EventHandler = (...args: unknown[]) => void;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let _announceIdCounter = 0;
function announceId(): string {
  return `ann-${++_announceIdCounter}`;
}

export class LookupClient {
  private readonly _rpc: RpcLayer;
  private readonly _subscriptions: SubscriptionManager;
  /**
   * RFC-032: post-quantum (WOTS/TreeKey) identity. Built once on construction
   * from `config.identitySeed` (or an injected `config.identity`) and reused
   * across reconnects so the use counter (anti-replay nonce) stays monotonic.
   */
  private readonly _authenticator: Authenticator;
  private _activeTransport: ITransport | null = null;
  private _destroyed = false;
  private _reconnectAttempt = 0;
  private _handlers = new Map<string, EventHandler[]>();

  constructor(private readonly _config: LookupClientConfig) {
    this._rpc = new RpcLayer(_config.timeoutMs ?? 10_000);
    this._subscriptions = new SubscriptionManager(this._rpc);

    const identity = _config.identity
      ?? (_config.identityWallet
        ? LookupIdentity.fromWallet(_config.identityWallet, { slot: _config.identitySlot ?? 'root' })
        : LookupIdentity.fromSeed(_config.identitySeed ?? new Uint8Array(32).fill(0), _config.identityOptions));
    this._authenticator = new Authenticator({
      identity,
      ...(_config.authTtlMs !== undefined ? { ttlMs: _config.authTtlMs } : {}),
      ...(_config.rootIdentityProof !== undefined ? { rootIdentityProof: _config.rootIdentityProof } : {}),
      ...(_config.address !== undefined ? { address: _config.address } : {}),
    });
    this._rpc.setAuthenticator(this._authenticator);
  }

  // ---------------------------------------------------------------------------
  // Internal connection lifecycle
  // ---------------------------------------------------------------------------

  async _connect(transport: ITransport): Promise<void> {
    this._activeTransport = transport;
    // RFC-032: no handshake. Authentication is carried per-message by the RpcLayer
    // (which stamps every outgoing message via the Authenticator).
    this._rpc.attach(transport);

    transport.onClose(() => {
      if (!this._destroyed) {
        this._activeTransport = null;
        this._rpc.detach();
        void this._scheduleReconnect();
      }
    });

    transport.onError(() => {
      // Errors always lead to 'close'; handled above
    });

    this._subscriptions.reRegisterAll();
    this._reconnectAttempt = 0;
    this._emit('reconnected');
  }

  private async _getTransport(): Promise<ITransport> {
    if (this._config._transportFactory) {
      return this._config._transportFactory();
    }
    if (this._config._transport) {
      return this._config._transport;
    }
    return createHyperswarmTransport(this._config);
  }

  private async _scheduleReconnect(): Promise<void> {
    const base = this._config.reconnectBaseMs ?? 1_000;
    const max = this._config.reconnectMaxMs ?? 30_000;
    const delay = Math.min(base * 2 ** this._reconnectAttempt, max);
    this._reconnectAttempt++;

    this._emit('reconnecting', { attempt: this._reconnectAttempt, delayMs: delay });

    await sleep(delay);
    if (this._destroyed) return;

    try {
      const transport = await this._getTransport();
      await this._connect(transport);
    } catch {
      if (!this._destroyed) void this._scheduleReconnect();
    }
  }

  // ---------------------------------------------------------------------------
  // Event emitter
  // ---------------------------------------------------------------------------

  on(event: 'reconnecting' | 'reconnected', handler: EventHandler): Unsubscribe {
    if (!this._handlers.has(event)) this._handlers.set(event, []);
    this._handlers.get(event)!.push(handler);
    return () => {
      const arr = this._handlers.get(event) ?? [];
      this._handlers.set(event, arr.filter(h => h !== handler));
    };
  }

  private _emit(event: string, ...args: unknown[]): void {
    this._handlers.get(event)?.forEach(h => h(...args));
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  disconnect(): void {
    this._destroyed = true;
    this._rpc.detach();
    // Close the underlying transport so connection resources are released
    if (this._activeTransport) {
      try { this._activeTransport.close(); } catch { /* ignore */ }
      this._activeTransport = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Watch registration
  // ---------------------------------------------------------------------------

  watchAddress(address: string): Promise<void> {
    this._subscriptions.watchAddress(address);
    return Promise.resolve();
  }

  watchScript(script: string): Promise<void> {
    this._subscriptions.watchScript(script);
    return Promise.resolve();
  }

  watchCoin(coinId: string): Promise<void> {
    this._subscriptions.watchCoin(coinId);
    return Promise.resolve();
  }

  subscribeCoinUpdates(cb: CoinUpdateCallback): Unsubscribe {
    return this._subscriptions.subscribeCoinUpdates(cb);
  }

  // ---------------------------------------------------------------------------
  // Chain queries
  // ---------------------------------------------------------------------------

  async getCoins(query: CoinsQuery): Promise<Coin[]> {
    const resp = await this._rpc.sendRequest({
      type: 'GET_COINS',
      version: PROTOCOL_VERSION,
      payload: {
        address: query.address,
        tokenId: query.tokenId,
        sendable: query.sendable,
        relevant: query.relevant,
      },
    });
    const p = resp.payload as { coins?: Coin[] };
    return p.coins ?? [];
  }

  async getCoin(coinId: string): Promise<Coin | null> {
    const resp = await this._rpc.sendRequest({
      type: 'GET_COIN',
      version: PROTOCOL_VERSION,
      payload: { coinId },
    });
    const p = resp.payload as { coin?: Coin | null };
    return p.coin ?? null;
  }

  async getProof(coinId: string): Promise<MMRProof> {
    const resp = await this._rpc.sendRequest({
      type: 'GET_PROOF',
      version: PROTOCOL_VERSION,
      payload: { coinId },
    });
    // Server sends PROOF_RESPONSE: { coinId: string; proof: unknown }
    const p = resp.payload as { coinId?: string; proof?: unknown };
    return { coinid: p.coinId ?? coinId, data: p.proof };
  }

  async getTip(): Promise<ChainTip> {
    const resp = await this._rpc.sendRequest({
      type: 'GET_TIP',
      version: PROTOCOL_VERSION,
      payload: {},
    });
    return resp.payload as ChainTip;
  }

  async getToken(tokenId: string): Promise<TokenInfo> {
    const resp = await this._rpc.sendRequest({
      type: 'GET_TOKEN',
      version: PROTOCOL_VERSION,
      payload: { tokenId },
    });
    // Server may wrap in { token: TokenInfo } or return TokenInfo directly
    const p = resp.payload as { token?: TokenInfo } | TokenInfo;
    if ('token' in p && p.token != null) return (p as { token: TokenInfo }).token;
    return p as TokenInfo;
  }

  async searchTokens(_query: TokenSearchQuery): Promise<TokenInfo[]> {
    // Not in wire protocol v1 — lookup-node will add in a future release
    return [];
  }

  async getTokensByCreator(_address: string): Promise<TokenInfo[]> {
    // Not in wire protocol v1
    return [];
  }

  async broadcastTxPoW(txpowHex: string): Promise<BroadcastResult> {
    const resp = await this._rpc.sendRequest({
      type: 'BROADCAST_TXPOW',
      version: PROTOCOL_VERSION,
      payload: { txpowHex },
    });
    return resp.payload as BroadcastResult;
  }

  // ---------------------------------------------------------------------------
  // WOTS lease coordination (LEASE_RESERVE / LEASE_COMMIT / LEASE_BURN)
  // ---------------------------------------------------------------------------

  async leaseReserve(params: {
    treeId: string;
    branchId?: string;
    deviceId?: string;
    ttlMs?: number;
    payloadHash?: string;
    purpose?: string;
  }): Promise<{ reservation: unknown; certificate?: unknown }> {
    const resp = await this._rpc.sendRequest({
      type: 'LEASE_RESERVE',
      version: PROTOCOL_VERSION,
      payload: params,
    });
    const p = resp.payload as { reservation?: unknown; certificate?: unknown };
    return { reservation: p.reservation, certificate: p.certificate };
  }

  async leaseCommit(reservationId: string, txId: string, indices: { addressIndex: number; l1: number; l2: number }): Promise<void> {
    await this._rpc.sendRequest({
      type: 'LEASE_COMMIT',
      version: PROTOCOL_VERSION,
      payload: { reservationId, txId, indices },
    });
  }

  async leaseBurn(reservationId: string, reason: string, indices: { addressIndex: number; l1: number; l2: number }): Promise<void> {
    await this._rpc.sendRequest({
      type: 'LEASE_BURN',
      version: PROTOCOL_VERSION,
      payload: { reservationId, reason, indices },
    });
  }

  // ---------------------------------------------------------------------------
  // Service / agent discovery announcements
  //
  // The manifest bytes must already be encoded (call encodeManifest from
  // @totemsdk/manifest). The session Ed25519 keypair signs those bytes —
  // no WOTS key index is consumed. The node verifies the Ed25519 sig at
  // ingest; it is not stored in any response and never hits the chain.
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // Service / agent discovery queries
  // ---------------------------------------------------------------------------

  async queryApps(params: {
    category?: string[];
    authorAddress?: string;
    minVersion?: number;
    freeOnly?: boolean;
    limit?: number;
  } = {}): Promise<Array<{ appId: string; manifest: Uint8Array; nodeId: string }>> {
    const resp = await this._rpc.sendRequest({
      type: 'APP_QUERY',
      version: PROTOCOL_VERSION,
      payload: params,
    });
    return (resp.payload as { apps: Array<{ appId: string; manifest: Uint8Array; nodeId: string }> }).apps ?? [];
  }

  async queryAgents(params: {
    capabilityName?: string;
    tags?: string[];
    maxPricePerCall?: number;
    maxLatencyMs?: number;
    limit?: number;
  } = {}): Promise<Array<{ capabilityId: string; manifest: Uint8Array; nodeId: string }>> {
    const resp = await this._rpc.sendRequest({
      type: 'AGENT_QUERY',
      version: PROTOCOL_VERSION,
      payload: params,
    });
    return (resp.payload as { agents: Array<{ capabilityId: string; manifest: Uint8Array; nodeId: string }> }).agents ?? [];
  }

  async announceApp(params: {
    /** Encoded SignedManifest bytes — call encodeManifest(signedManifest) first. */
    manifest: Uint8Array;
    appId: string;
    expiresAt: number;
    authorAddress?: string;
    isFree?: boolean;
  }): Promise<void> {
    // RFC-032: the manifest is WOTS-signed by @totemsdk/manifest; the RpcLayer
    // stamps the message-level WOTS auth envelope on send.
    this._rpc.sendRaw({
      type: 'APP_ANNOUNCE',
      version: PROTOCOL_VERSION,
      id: announceId(),
      payload: {
        manifest: params.manifest,
        appId: params.appId,
        expiresAt: params.expiresAt,
        authorAddress: params.authorAddress,
        isFree: params.isFree,
      },
    });
  }

  async announceAgent(params: {
    /** Encoded SignedManifest bytes — call encodeManifest(signedManifest) first. */
    manifest: Uint8Array;
    capabilityId: string;
    expiresAt: number;
    tags?: string[];
    pricePerCall?: number;
    latencyMs?: number;
  }): Promise<void> {
    this._rpc.sendRaw({
      type: 'AGENT_ANNOUNCE',
      version: PROTOCOL_VERSION,
      id: announceId(),
      payload: {
        manifest: params.manifest,
        capabilityId: params.capabilityId,
        expiresAt: params.expiresAt,
        tags: params.tags,
        pricePerCall: params.pricePerCall,
        latencyMs: params.latencyMs,
      },
    });
  }
}
