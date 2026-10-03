/**
 * RFC-032: server-side post-quantum authentication for the lookup node.
 *
 * Replaces the Ed25519 AUTH_CHALLENGE/AUTH_RESPONSE handshake. The node verifies
 * the WOTS auth envelope on every authenticated message and enforces two
 * anti-replay rules per identity:
 *   1. `expiresAt` must be in the future.
 *   2. the per-identity nonce must be strictly increasing and never reused.
 *
 * Replay rejection is mandatory: WOTS signatures are static and the identity's
 * signing indices are one-time.
 */

import { verifyMessageAuth } from '@totemsdk/lookup-protocol';
import type { LookupMessage } from '@totemsdk/lookup-protocol';
import { verifyTreeSignature, deserializeTreeSignature, hexToBytes } from '@totemsdk/core';

export interface AuthVerifyResult {
  valid: boolean;
  publicKeyHex?: string;
  nonce?: number;
  reason?: string;
}

/**
 * Verify a message's WOTS auth envelope against the message content. Does NOT
 * mutate replay state — callers pass the result to {@link ReplayGuard}.
 */
export async function verifyAuthEnvelope(
  msg: LookupMessage,
  now: number = Date.now(),
): Promise<AuthVerifyResult> {
  const auth = msg.auth;
  if (!auth) return { valid: false, reason: 'missing auth envelope' };
  if (msg.type === 'HELLO' || msg.type === 'PING') {
    // Unauthenticated liveness messages.
    return { valid: true };
  }

  const valid = await verifyMessageAuth(
    msg,
    (digest, signature, pkDigest) => {
      // Flat WOTS verify would use wotsVerifyDigest, but the client signs with a
      // TreeKey (serialized TreeSignature), so verify hierarchically.
      try {
        return verifyTreeSignature(pkDigest, digest, deserializeTreeSignature(signature));
      } catch {
        return false;
      }
    },
    now,
  );

  if (!valid) return { valid: false, reason: 'invalid or expired WOTS signature' };
  return { valid: true, publicKeyHex: auth.rootPublicKey, nonce: auth.nonce };
}

// ── Replay guard ────────────────────────────────────────────────────────────

/**
 * Tracks the highest accepted nonce per root public key. A nonce is accepted
 * only when strictly greater than the last seen value for that identity, which
 * rejects both verbatim replays and out-of-order reuse.
 *
 * In-memory by default; supply a durable implementation for multi-process nodes.
 */
export class ReplayGuard {
  private readonly _seen = new Map<string, number>();

  /**
   * Claim a nonce for `publicKeyHex`. Returns false when the identity has
   * already used this nonce or a higher one (replay/reorder).
   */
  claim(publicKeyHex: string, nonce: number): boolean {
    const last = this._seen.get(publicKeyHex);
    if (last !== undefined && nonce <= last) return false;
    this._seen.set(publicKeyHex, nonce);
    return true;
  }

  /** Highest accepted nonce for an identity, if any. */
  highWatermark(publicKeyHex: string): number | undefined {
    return this._seen.get(publicKeyHex);
  }
}
