/**
 * RFC-032: post-quantum authentication for the lookup client.
 *
 * Replaces the Ed25519 HELLO → AUTH_CHALLENGE → AUTH_RESPONSE handshake. Every
 * outgoing message is stamped with a {@link WotsAuthEnvelope}: the client signs
 * `authDigest(msg, nonce, expiresAt)` with its WOTS/TreeKey identity. Each
 * message consumes one TreeKey use (the anti-replay nonce).
 */

import { authDigest } from '@totemsdk/lookup-protocol';
import type { LookupMessage, WotsAuthEnvelope } from '@totemsdk/lookup-protocol';
import { bytesToHex } from '@totemsdk/core';
import type { LookupIdentity } from './identity.js';

export { LookupIdentity, verifyIdentitySignature } from './identity.js';

/** Default auth envelope lifetime. */
export const DEFAULT_AUTH_TTL_MS = 60_000;

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

  constructor(options: AuthenticatorOptions) {
    this._identity = options.identity;
    this._ttlMs = options.ttlMs ?? DEFAULT_AUTH_TTL_MS;
    this._now = options.now ?? (() => Date.now());
    this._proof = options.rootIdentityProof;
    this._address = options.address;
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

  /** Attach an auth envelope to a message (returns a new message object). */
  stamp<T extends LookupMessage>(msg: Omit<T, 'auth'>): T {
    const { auth: _ignored, ...unsigned } = msg as T & { auth?: unknown };
    const expiresAt = this._now() + this._ttlMs;
    // Compute the digest with a provisional nonce, then sign, then bind the
    // actual nonce the identity consumed (they must match).
    const provisionalNonce = this._identity.uses;
    const digest = authDigest(
      unsigned as Omit<LookupMessage, 'auth' | 'sig'>,
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
