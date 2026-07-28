/**
 * ClientSession — manages one authenticated client connection.
 *
 * Lifecycle:
 *   1. New connection arrives → session is created, AUTH_CHALLENGE is sent immediately.
 *   2. Client sends HELLO → session ignores (challenge already sent) or re-sends challenge.
 *   3. Client sends AUTH_RESPONSE → server verifies → authenticated = true → PONG sent.
 *   4. All subsequent messages are rate-limited and dispatched to the appropriate handler.
 *   5. On close: session is removed from the node's session map.
 */

import { encodeMessage } from '@totemsdk/lookup-protocol';
import type { LookupMessage } from '@totemsdk/lookup-protocol';
import type { ChainStateProvider } from '@totemsdk/chain-provider';
import { generateChallenge, verifyAuthResponse } from './server-auth.js';
import {
  handleGetCoins,
  handleGetCoin,
  handleGetProof,
  handleGetTip,
  handleGetToken,
  handleBroadcastDirect,
  sendError,
  makeRawSender,
} from './handlers.js';
import type { SendFn } from './handlers.js';
import { FrameParser } from './framing.js';
import type { WatchlistManager } from './watchlist.js';
import type { TxPoWRelay } from './relay.js';
import type { LeaseCoordinator } from './lease.js';
import type { AppRegistry, AgentRegistry } from './registry.js';
import type { TrustIndex } from './trust.js';
import type { ITransport, LookupNodeConfig } from './types.js';
import type { SqliteStore } from './storage.js';

// ---------------------------------------------------------------------------
// Dispatcher interface (avoids circular ref with LookupNode)
// ---------------------------------------------------------------------------

export interface NodeDispatcher {
  readonly provider: ChainStateProvider;
  readonly config: LookupNodeConfig;
  readonly store?: SqliteStore;
  readonly watchlist: WatchlistManager;
  readonly relay?: TxPoWRelay;
  readonly lease?: LeaseCoordinator;
  readonly appRegistry?: AppRegistry;
  readonly agentRegistry?: AgentRegistry;
  readonly trustIndex?: TrustIndex;
  onSessionClosed(sessionId: string): void;
  nodeId: string;
  isMegaMMRMode: boolean;
}

// ---------------------------------------------------------------------------
// ClientSession
// ---------------------------------------------------------------------------

export class ClientSession {
  readonly sessionId: string;
  authenticated = false;
  publicKeyHex?: string;
  readonly connectedAt = Date.now();
  private _rpmCount = 0;
  private _rpmWindowStart = Date.now();

  private readonly _parser = new FrameParser();
  private readonly _sendFn: SendFn;
  private _challenge: string;
  private _challengeExpiresAt: number;
  private _destroyed = false;

  constructor(
    private readonly _transport: ITransport,
    private readonly _dispatcher: NodeDispatcher,
  ) {
    this.sessionId = `session-${Math.random().toString(36).slice(2)}-${Date.now()}`;
    this._sendFn = makeRawSender(_transport);

    // Issue challenge immediately
    const { challenge, expiresAt } = generateChallenge(
      _dispatcher.config.challengeTtlMs ?? 30_000,
    );
    this._challenge = challenge;
    this._challengeExpiresAt = expiresAt;
    this._sendFn({
      type: 'AUTH_CHALLENGE',
      version: 1,
      payload: { challenge, expiresAt },
    });

    // Wire transport events
    _transport.on('data', (chunk) => this._onData(chunk));
    _transport.on('close', () => this._onClose());
    _transport.on('error', (_err) => this._onClose());
  }

  // ---------------------------------------------------------------------------
  // Internal event handlers
  // ---------------------------------------------------------------------------

  private _onData(chunk: Uint8Array): void {
    let messages: LookupMessage[];
    try {
      messages = this._parser.push(chunk);
    } catch {
      this._transport.close();
      return;
    }
    for (const msg of messages) {
      this._handleMessage(msg).catch((err) => {
        if (msg.id) {
          sendError(this._sendFn, msg.id, 'INTERNAL_ERROR', String(err));
        }
      });
    }
  }

  private _onClose(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this._dispatcher.watchlist.removeSession(this.sessionId);
    this._dispatcher.onSessionClosed(this.sessionId);
  }

  private async _handleMessage(msg: LookupMessage): Promise<void> {
    if (msg.type === 'HELLO') {
      // Re-send the challenge in case the client missed it
      this._sendFn({
        type: 'AUTH_CHALLENGE',
        version: 1,
        id: msg.id,
        payload: { challenge: this._challenge, expiresAt: this._challengeExpiresAt },
      });
      return;
    }

    if (!this.authenticated) {
      if (msg.type === 'AUTH_RESPONSE') {
        await this._handleAuthResponse(msg);
      } else {
        sendError(this._sendFn, msg.id, 'AUTH_REQUIRED', 'Not authenticated');
      }
      return;
    }

    // Rate limiting
    const rateLimitRpm = this._dispatcher.config.rateLimitRpm ?? 120;
    const now = Date.now();
    if (now - this._rpmWindowStart > 60_000) {
      this._rpmCount = 0;
      this._rpmWindowStart = now;
    }
    this._rpmCount++;
    if (this._rpmCount > rateLimitRpm) {
      sendError(this._sendFn, msg.id, 'RATE_LIMITED', 'Too many requests');
      return;
    }

    await this._dispatch(msg);
  }

  private async _handleAuthResponse(
    msg: Extract<LookupMessage, { type: 'AUTH_RESPONSE' }>,
  ): Promise<void> {
    let valid = true;
    let publicKeyHex = msg.payload.publicKey;

    if (!this._dispatcher.config._skipAuth) {
      const result = await verifyAuthResponse(
        msg.payload,
        this._challenge,
        this._challengeExpiresAt,
      );
      valid = result.valid;
      publicKeyHex = result.publicKeyHex;
      if (!valid) {
        sendError(this._sendFn, msg.id, 'AUTH_FAILED', result.reason ?? 'invalid auth');
        return;
      }
    }

    this.authenticated = true;
    this.publicKeyHex = publicKeyHex;

    this._sendFn({
      type: 'PONG',
      version: 1,
      id: msg.id,
      payload: { ts: Date.now(), echo: 0 },
    });
  }

  private async _dispatch(msg: LookupMessage): Promise<void> {
    const { provider, store } = this._dispatcher;

    switch (msg.type) {
      case 'GET_COINS':
        await handleGetCoins(msg, provider, this._sendFn, store, this._dispatcher.isMegaMMRMode);
        break;

      case 'GET_COIN':
        await handleGetCoin(msg, provider, this._sendFn, store);
        break;

      case 'GET_PROOF':
        await handleGetProof(msg, provider, this._sendFn);
        break;

      case 'GET_TIP':
        await handleGetTip(msg, provider, this._sendFn, store);
        break;

      case 'GET_TOKEN':
        await handleGetToken(msg, provider, this._sendFn, store);
        break;

      case 'BROADCAST_TXPOW': {
        const relay = this._dispatcher.relay;
        if (relay) {
          const result = await relay.process(msg.payload.txpowHex);
          this._sendFn({
            type: 'BROADCAST_RESPONSE',
            version: 1,
            id: msg.id,
            payload: { success: result.success, message: result.message, txpowid: result.txpowid },
          });
        } else {
          await handleBroadcastDirect(msg, provider, this._sendFn);
        }
        break;
      }

      case 'WATCH_REGISTER':
        this._dispatcher.watchlist.register(
          this.sessionId,
          msg.payload.addresses,
          this._transport,
        );
        break;

      case 'WATCH_REMOVE':
        this._dispatcher.watchlist.remove(this.sessionId, msg.payload.addresses);
        break;

      case 'LEASE_RESERVE': {
        const lease = this._dispatcher.lease;
        if (lease) {
          await lease.handleReserve(msg, this._sendFn, this.publicKeyHex);
        } else {
          sendError(this._sendFn, msg.id, 'NOT_SUPPORTED', 'Lease coordinator not enabled');
        }
        break;
      }

      case 'LEASE_COMMIT': {
        const lease = this._dispatcher.lease;
        if (lease) {
          await lease.handleCommit(msg, this._sendFn, this.publicKeyHex);
        } else {
          sendError(this._sendFn, msg.id, 'NOT_SUPPORTED', 'Lease coordinator not enabled');
        }
        break;
      }

      case 'LEASE_BURN': {
        const lease = this._dispatcher.lease;
        if (lease) {
          await lease.handleBurn(msg, this._sendFn, this.publicKeyHex);
        } else {
          sendError(this._sendFn, msg.id, 'NOT_SUPPORTED', 'Lease coordinator not enabled');
        }
        break;
      }

      case 'APP_ANNOUNCE': {
        const reg = this._dispatcher.appRegistry;
        if (reg) await reg.announce(msg, this._dispatcher.nodeId);
        break;
      }

      case 'APP_QUERY': {
        const reg = this._dispatcher.appRegistry;
        if (reg) {
          reg.query(msg, this._sendFn);
        } else {
          sendError(this._sendFn, msg.id, 'NOT_SUPPORTED', 'App registry not enabled');
        }
        break;
      }

      case 'AGENT_ANNOUNCE': {
        const reg = this._dispatcher.agentRegistry;
        if (reg) await reg.announce(msg, this._dispatcher.nodeId);
        break;
      }

      case 'AGENT_QUERY': {
        const reg = this._dispatcher.agentRegistry;
        if (reg) {
          reg.query(msg, this._sendFn);
        } else {
          sendError(this._sendFn, msg.id, 'NOT_SUPPORTED', 'Agent registry not enabled');
        }
        break;
      }

      case 'TRUST_RECORD': {
        const ti = this._dispatcher.trustIndex;
        if (ti) ti.record(msg);
        break;
      }

      case 'TRUST_QUERY': {
        const ti = this._dispatcher.trustIndex;
        if (ti) {
          ti.query(msg, this._sendFn);
        } else {
          sendError(this._sendFn, msg.id, 'NOT_SUPPORTED', 'Trust index not enabled');
        }
        break;
      }

      case 'PING':
        this._sendFn({
          type: 'PONG',
          version: 1,
          id: msg.id,
          payload: { ts: Date.now(), echo: (msg.payload as { ts: number }).ts },
        });
        break;

      default:
        // Silently ignore unknown/server-only message types
        break;
    }
  }

  // Expose for encoding
  encode(msg: LookupMessage): Uint8Array {
    return encodeMessage(msg);
  }
}
