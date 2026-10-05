/**
 * RFC-032: post-quantum authentication for the lookup client.
 *
 * Replaces the Ed25519 HELLO → AUTH_CHALLENGE → AUTH_RESPONSE handshake. Every
 * outgoing message is stamped with a {@link WotsAuthEnvelope}: the client signs
 * `authDigest(msg, nonce, expiresAt)` with its WOTS/TreeKey identity. Each
 * message consumes one TreeKey use (the anti-replay nonce).
 */

import { authDigest } from '@totemsdk/lookup-protocol';
import type { LookupMessage, SessionTicket, WotsAuthEnvelope } from '@totemsdk/lookup-protocol';
import { bytesToHex } from '@totemsdk/core';
import type { LookupIdentity } from './identity.js';

export { LookupIdentity, verifyIdentitySignature } from './identity.js';

/** Default auth envelope lifetime. */
export const DEFAULT_AUTH_TTL_MS = 60_000;

/**
 * RFC-032-A: message types that must always carry a full WOTS `auth` envelope,
 * never a session ticket. Must mirror the node's `authRequiredTypes`.
 */
export const DEFAULT_AUTH_REQUIRED_TYPES: readonly string[] = [
  'LEASE_RESERVE',
  'LEASE_COMMIT',
  'LEASE_BURN',
  'BROADCAST_TXPOW',
  'TRUST_RECORD',
  'APP_ANNOUNCE',
  'AGENT_ANNOUNCE',
  'POLICY_ANNOUNCE',
];

export interface AuthenticatorOptions {
  identity: LookupIdentity;
  /** Auth envelope TTL in ms. Default {@link DEFAULT_AUTH_TTL_MS}. */
  ttlMs?: number;
  /** Injectable clock (defaults to Date.now). */
  now?: () => number;
  /** Optional root-identity proof binding (RFC-032 §5.1.1). */
  rootIdentityProof?: string;
  /** Optional Minima address (only trusted by the node when the proof verifies). */
  address?: string;
  /**
   * RFC-032-A: request a session ticket on connect and use it (instead of
   * per-message WOTS) for non-high-value messages. Default false until the
   * caller has performed a SESSION_OPEN.
   */
  useTickets?: boolean;
  /** RFC-032-A: message types that always require a full WOTS envelope. */
  authRequiredTypes?: readonly string[];
  /** RFC-032-A: requested ticket lifetime (node clamps). */
  sessionTtlMs?: number;
}

/**
 * Stamps WOTS auth envelopes onto outgoing messages. Stateful: each message
 * consumes one identity use, and the use index is the wire nonce.
 */
export class Authenticator {
  private readonly _identity: LookupIdentity;
  private readonly _ttlMs: number;
  private readonly _now: () => number;
  private readonly _proof?: string;
  private readonly _address?: string;
  private readonly _useTickets: boolean;
  private readonly _authRequiredTypes: readonly string[];
  private readonly _sessionTtlMs?: number;
  /** RFC-032-A: current session ticket, when held. */
  private _ticket?: SessionTicket;
  /** RFC-032-A: monotonic per-ticket request counter. */
  private _seq = 0;

  constructor(options: AuthenticatorOptions) {
    this._identity = options.identity;
    this._ttlMs = options.ttlMs ?? DEFAULT_AUTH_TTL_MS;
    this._now = options.now ?? (() => Date.now());
    this._proof = options.rootIdentityProof;
    this._address = options.address;
    this._useTickets = options.useTickets === true;
    this._authRequiredTypes = options.authRequiredTypes ?? DEFAULT_AUTH_REQUIRED_TYPES;
    this._sessionTtlMs = options.sessionTtlMs;
  }

  get rootPublicKey(): string {
    return this._identity.rootPublicKey;
  }

  get uses(): number {
    return this._identity.uses;
  }

  get maxUses(): number {
    return this._identity.maxUses;
  }

  /** RFC-032-A: whether tickets should be requested/used. */
  get useTickets(): boolean {
    return this._useTickets;
  }

  /** RFC-032-A: requested ticket lifetime. */
  get sessionTtlMs(): number | undefined {
    return this._sessionTtlMs;
  }

  /** Record a freshly received session ticket (resets the local seq). */
  setTicket(ticket: SessionTicket): void {
    this._ticket = ticket;
    this._seq = 0;
  }

  /** Drop the current ticket (expired/exhausted/reconnect). */
  clearTicket(): void {
    this._ticket = undefined;
    this._seq = 0;
  }

  /** True when a currently-valid (unexpired) ticket is held. */
  hasValidTicket(): boolean {
    return this._ticket !== undefined && this._now() <= this._ticket.expiresAt;
  }

  /** A message needs a full envelope when tickets are off, none is held, or the type is high-value. */
  private _needsEnvelope(type: string): boolean {
    if (!this._useTickets) return true;
    if (this._authRequiredTypes.includes(type)) return true;
    return !this.hasValidTicket();
  }

  /**
   * Attach authentication to a message (returns a new message object):
   *  - a full WOTS `auth` envelope (SESSION_OPEN, high-value, or no ticket), or
   *  - a `ticket: { ticketId, seq }` reference (amortised).
   */
  stamp<T extends LookupMessage>(msg: Omit<T, 'auth' | 'ticket'>): T {
    const { auth: _a, ticket: _t, ...unsigned } = msg as T & { auth?: unknown; ticket?: unknown };

    if (!this._needsEnvelope(unsigned.type) && this._ticket) {
      const ref = { ticketId: this._ticket.ticketId, seq: this._seq++ };
      return { ...(unsigned as T), ticket: ref };
    }

    const expiresAt = this._now() + this._ttlMs;
    // Compute the digest with a provisional nonce, then sign, then bind the
    // actual nonce the identity consumed (they must match).
    const provisionalNonce = this._identity.uses;
    const digest = authDigest(
      unsigned as Omit<LookupMessage, 'auth' | 'ticket' | 'sig'>,
      provisionalNonce,
      expiresAt,
    );
    const { signature, nonce } = this._identity.sign(digest);
    if (nonce !== provisionalNonce) {
      throw new Error('Authenticator: identity nonce advanced unexpectedly during signing');
    }
    const auth: WotsAuthEnvelope = {
      rootPublicKey: this._identity.rootPublicKey,
      signature: bytesToHex(signature).toLowerCase(),
      nonce,
      expiresAt,
      ...(this._proof !== undefined ? { rootIdentityProof: this._proof } : {}),
      ...(this._address !== undefined ? { address: this._address } : {}),
    };
    return { ...(unsigned as T), auth };
  }
}
