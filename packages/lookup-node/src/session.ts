/**
 * ClientSession — manages one post-quantum-authenticated client connection.
 *
 * RFC-032: there is no HELLO → AUTH_CHALLENGE → AUTH_RESPONSE handshake. Every
 * non-liveness message carries a WOTS auth envelope (identity + nonce + expiry
 * + signature). The session verifies it and enforces per-identity nonce
 * monotonicity (replay rejection) before dispatching.
 *
 * Lifecycle:
 *   1. Connection arrives → session created (no challenge sent).
 *   2. Client sends a message with a valid `auth` envelope → accepted; the
 *      session records its public key and advances the identity nonce.
 *   3. HELLO/PING are answered without authentication.
 *   4. On close: session removed from the node's session map.
 */

import { encodeMessage } from '@totemsdk/lookup-protocol';
import { randomBytes } from 'node:crypto';
import type { LookupMessage } from '@totemsdk/lookup-protocol';
import type { ChainStateProvider } from '@totemsdk/chain-provider';
import { verifyAuthEnvelope, ReplayGuard, NodeIdentity } from './auth-verify.js';
import { SessionTicketStore } from './ticket-store.js';
import type { SessionTicket } from '@totemsdk/lookup-protocol';
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
  /** RFC-020 H11: per-identity rate limit that survives reconnects. */
  checkIdentityRate(publicKeyHex: string | undefined, rpm: number, now?: number): boolean;
  /** RFC-032: node-wide replay guard shared across sessions. */
  readonly replayGuard: ReplayGuard;
  /** RFC-032-A: node WOTS identity (signs session tickets). */
  readonly nodeIdentity: NodeIdentity;
  /** RFC-032-A: session ticket store (lifetime/budget/seq). */
  readonly tickets: SessionTicketStore;
  nodeId: string;
  isMegaMMRMode: boolean;
}

/**
 * RFC-032-A: high-value/mutating message types that must carry a full WOTS
 * `auth` envelope and may never rely on a session ticket alone (§A.5).
 */
const DEFAULT_AUTH_REQUIRED_TYPES: readonly string[] = [
  'LEASE_RESERVE',
  'LEASE_COMMIT',
  'LEASE_BURN',
  'BROADCAST_TXPOW',
  'TRUST_RECORD',
  'APP_ANNOUNCE',
  'AGENT_ANNOUNCE',
  'POLICY_ANNOUNCE',
];

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
  private _destroyed = false;

  constructor(
    private readonly _transport: ITransport,
    private readonly _dispatcher: NodeDispatcher,
  ) {
    this.sessionId = `session-${randomBytes(8).toString('hex')}-${Date.now()}`;
    this._sendFn = makeRawSender(_transport);

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
    // Unauthenticated liveness: HELLO is acknowledged, PING is answered.
    if (msg.type === 'PING') {
      this._sendFn({
        type: 'PONG',
        version: 2,
        id: msg.id,
        payload: { ts: Date.now(), echo: (msg.payload as { ts: number }).ts },
      });
      return;
    }
    if (msg.type === 'HELLO') {
      this._sendFn({
        type: 'PONG',
        version: 2,
        id: msg.id,
        payload: { ts: Date.now(), echo: 0 },
      });
      return;
    }

    // RFC-032-A: session establishment (one WOTS use) and teardown.
    if (msg.type === 'SESSION_OPEN') {
      await this._handleSessionOpen(msg);
      return;
    }
    if (msg.type === 'SESSION_CLOSE') {
      this._dispatcher.tickets.revoke((msg.payload as { ticketId: string }).ticketId);
      this._sendFn({ type: 'PONG', version: 2, id: msg.id, payload: { ts: Date.now(), echo: 0 } });
      return;
    }

    // RFC-032 / RFC-032-A: authenticate via the full WOTS envelope, or (for
    // non-high-value types) a node-issued session ticket.
    if (!this._dispatcher.config._skipAuth) {
      const ok = await this._authenticate(msg);
      if (!ok) return; // an error was already sent
    } else if (msg.auth) {
      // Test mode: adopt the envelope identity for identity-based limits.
      this.authenticated = true;
      this.publicKeyHex = msg.auth.rootPublicKey;
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
    // RFC-020 H11: a fuzzy per-identity limit that survives reconnect.
    if (!this._dispatcher.checkIdentityRate(this.publicKeyHex, rateLimitRpm, now)) {
      sendError(this._sendFn, msg.id, 'RATE_LIMITED', 'Too many requests for this identity');
      return;
    }

    await this._dispatch(msg);
  }

  /**
   * RFC-032-A: verify a SESSION_OPEN (one WOTS use) and mint a node-signed
   * ticket bound to the authenticated identity.
   */
  private async _handleSessionOpen(msg: LookupMessage): Promise<void> {
    const result = await verifyAuthEnvelope(msg);
    if (!result.valid || result.publicKeyHex === undefined || result.nonce === undefined) {
      sendError(this._sendFn, msg.id, 'AUTH_REQUIRED', result.reason ?? 'invalid SESSION_OPEN');
      return;
    }
    if (!this._dispatcher.replayGuard.claim(result.publicKeyHex, result.nonce)) {
      sendError(this._sendFn, msg.id, 'AUTH_REPLAY', 'Replayed or non-monotonic nonce');
      return;
    }
    this.authenticated = true;
    this.publicKeyHex = result.publicKeyHex;

    const cfg = this._dispatcher.config;
    const now = Date.now();
    const ttlMs = Math.min(
      (msg.payload as { ttlMs?: number }).ttlMs ?? cfg.sessionTtlMs ?? 60_000,
      cfg.sessionTtlMs ?? 60_000,
    );
    const ticket: SessionTicket = {
      ticketId: `tkt-${randomBytes(16).toString('hex')}`,
      subject: result.publicKeyHex,
      nodeId: this._dispatcher.nodeId,
      issuedAt: now,
      expiresAt: now + ttlMs,
      maxRequests: cfg.sessionMaxRequests ?? 1000,
      signature: '',
    };
    ticket.signature = this._dispatcher.nodeIdentity.signTicket({
      ticketId: ticket.ticketId,
      subject: ticket.subject,
      nodeId: ticket.nodeId,
      issuedAt: ticket.issuedAt,
      expiresAt: ticket.expiresAt,
      maxRequests: ticket.maxRequests,
    });
    this._dispatcher.tickets.issue(ticket);
    this._sendFn({ type: 'SESSION_TICKET', version: 2, id: msg.id, payload: ticket });
  }

  /**
   * Authenticate a message. Returns true on success; on failure an error has
   * been sent and the caller must stop. Prefers the full WOTS envelope; falls
   * back to a session ticket unless the type is in `authRequiredTypes`.
   */
  private async _authenticate(msg: LookupMessage): Promise<boolean> {
    if (msg.auth) {
      const result = await verifyAuthEnvelope(msg);
      if (!result.valid || result.publicKeyHex === undefined || result.nonce === undefined) {
        sendError(this._sendFn, msg.id, 'AUTH_REQUIRED', result.reason ?? 'invalid auth');
        return false;
      }
      if (!this._dispatcher.replayGuard.claim(result.publicKeyHex, result.nonce)) {
        sendError(this._sendFn, msg.id, 'AUTH_REPLAY', 'Replayed or non-monotonic nonce');
        return false;
      }
      this.authenticated = true;
      this.publicKeyHex = result.publicKeyHex;
      return true;
    }

    // No envelope. A ticket is acceptable only when the type allows it.
    if (this._isAuthRequired(msg.type)) {
      sendError(this._sendFn, msg.id, 'AUTH_REQUIRED', `'${msg.type}' requires a WOTS auth envelope`);
      return false;
    }
    const ref = msg.ticket;
    if (!ref) {
      sendError(this._sendFn, msg.id, 'AUTH_REQUIRED', 'Not authenticated');
      return false;
    }
    const verdict = this._dispatcher.tickets.consume(ref.ticketId, ref.seq);
    if (!verdict.ok) {
      const code = verdict.reason === 'replay' ? 'AUTH_REPLAY'
        : verdict.reason === 'expired' || verdict.reason === 'exhausted' || verdict.reason === 'unknown'
          ? 'SESSION_EXPIRED'
          : 'AUTH_REQUIRED';
      sendError(this._sendFn, msg.id, code, `session ticket rejected: ${verdict.reason}`);
      return false;
    }
    this.authenticated = true;
    this.publicKeyHex = verdict.subject;
    return true;
  }

  private _isAuthRequired(type: string): boolean {
    const list = this._dispatcher.config.authRequiredTypes ?? DEFAULT_AUTH_REQUIRED_TYPES;
    return list.includes(type);
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
            version: 2,
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
        if (ti) await ti.record(msg, this.publicKeyHex);
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
