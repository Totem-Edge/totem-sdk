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

import { verifyMessageAuth, sessionTicketDigest } from '@totemsdk/lookup-protocol';
import type { LookupMessage, SessionTicket } from '@totemsdk/lookup-protocol';
import {
  verifyTreeSignature,
  deserializeTreeSignature,
  serializeTreeSignature,
  createPerAddressTreeKey,
  bytesToHex,
  hexToBytes,
  sha3_256,
} from '@totemsdk/core';
import type { TreeKey } from '@totemsdk/core';

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

// ── Node identity + session tickets (RFC-032-A) ─────────────────────────────

function toHexLower(bytes: Uint8Array): string {
  return bytesToHex(bytes).toLowerCase();
}

/**
 * The node's post-quantum (WOTS/TreeKey) identity, used to sign session tickets.
 *
 * Derivation: `sha3_256("lookup-node-identity:" + nodeId)` → TreeKey. Stable for
 * a given `nodeId`; the use counter (one leaf per ticket) must be persisted and
 * restored forward-only across restarts (see `watermark` in the constructor), or
 * a restart could re-use a signing leaf.
 */
export class NodeIdentity {
  private readonly _treeKey: TreeKey;

  private constructor(
    treeKey: TreeKey,
    readonly nodeId: string,
    /** Called with the new use count after each ticket signature (persistence). */
    private readonly _persist?: (uses: number) => void,
  ) {
    this._treeKey = treeKey;
  }

  static fromNodeId(
    nodeId: string,
    startUses = 0,
    persist?: (uses: number) => void,
  ): NodeIdentity {
    const seed = sha3_256(new TextEncoder().encode(`lookup-node-identity:${nodeId}`));
    const treeKey = createPerAddressTreeKey(seed, 0);
    if (startUses > 0) treeKey.setUses(startUses);
    return new NodeIdentity(treeKey, nodeId, persist);
  }

  /** Hex root public key of the node identity (what clients verify tickets against). */
  get publicKey(): string {
    return toHexLower(this._treeKey.getPublicKey());
  }

  /** Number of tickets signed so far (persist this; never rewind). */
  get uses(): number {
    return this._treeKey.getUses();
  }

  /** Restore the use counter forward-only (never below the current value). */
  setUses(uses: number): void {
    if (!Number.isSafeInteger(uses) || uses < this._treeKey.getUses()) {
      throw new Error(`Refusing to set node identity uses to ${uses} (would reuse a signing leaf)`);
    }
    this._treeKey.setUses(uses);
  }

  /** Sign a session ticket payload (payload minus `signature`). */
  signTicket(ticket: Omit<SessionTicket, 'signature'>): string {
    const digest = sessionTicketDigest(ticket);
    const sig = toHexLower(serializeTreeSignature(this._treeKey.sign(digest)));
    this._persist?.(this._treeKey.getUses());
    return sig;
  }

  /** Verify a ticket's signature against this node identity. */
  verifyTicket(ticket: SessionTicket): boolean {
    try {
      const { signature, ...rest } = ticket;
      const digest = sessionTicketDigest(rest);
      return verifyTreeSignature(this._treeKey.getPublicKey(), digest, deserializeTreeSignature(hexToBytes(signature)));
    } catch {
      return false;
    }
  }
}
