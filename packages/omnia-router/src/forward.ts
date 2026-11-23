/**
 * Multi-hop forwarding envelopes (RFC-035 B4).
 *
 * A forwarder is handed an opaque `routingEnvelope` alongside an incoming HTLC
 * and peels one hop from it: it learns the next hop, locks an HTLC onward, and
 * passes the remaining (smaller) envelope to that hop.
 *
 * The envelope is deliberately **opaque** so the representation is pluggable: the
 * cleartext codec (below) is the first implementation; an onion (X25519 + AEAD,
 * per-hop encryption keys advertised on graph edges) can be added behind the same
 * `RoutingEnvelopeCodec` seam without changing the message types.
 */

import type { Route, RoutingHop, SwapHop } from './types.js';

/** Onward instruction the forwarder peels from an envelope. */
export interface ForwardHop {
  /** Next-hop party public-key digest (the immediate recipient of the outgoing HTLC). */
  via: string;
  /** Optional explicit outgoing channel id (else the forwarder finds its channel to `via`). */
  channelId?: string;
  amount: bigint;
  tokenId: string;
  /** Absolute timeout (block) for the outgoing HTLC, when the envelope carries one. */
  timeoutBlock?: bigint;
}

export type PeelResult =
  /** This node is the recipient — no onward hop. */
  | { kind: 'final' }
  /** Forward to `next`; `onward` is the remaining envelope for that hop (absent at the last hop). */
  | { kind: 'forward'; next: ForwardHop; onward?: string };

export interface RoutingEnvelopeCodec {
  /**
   * What a forwarder can learn from the envelope. `cleartext` means the path is
   * visible to every hop it passes through, so a capability manifest must not
   * claim path privacy while this codec is in use (RFC-035 §6.7).
   */
  readonly pathPrivacy: 'cleartext' | 'onion';
  /** Sender: build the envelope from the onward hops (already excludes the first hop). */
  build(hops: (RoutingHop | SwapHop)[]): string;
  /** Forwarder: peel one hop for `self`. */
  peel(envelope: string, self: { publicKeyDigest: string }): PeelResult;
}

/**
 * Cleartext routing codec: the envelope is the JSON of the remaining hops.
 * No confidentiality — a forwarder sees the path. Suitable for the RFC-035
 * "known counterparties" scope; swap for an onion codec when path privacy is
 * required.
 */
export function createCleartextRoutingCodec(): RoutingEnvelopeCodec {
  interface WireHop {
    channelId?: string;
    to: string;
    amount: string;
    tokenId: string;
    timeoutBlock?: string;
  }
  return {
    pathPrivacy: 'cleartext',
    build(hops) {
      const wire: WireHop[] = hops.map((h) => ({
        channelId: h.channelId,
        to: h.to,
        amount: h.amount.toString(),
        tokenId: h.tokenId,
        // Without this the forwarder has no bound to apply and would have to
        // reuse the incoming timeout, which can never be strictly earlier.
        ...(h.timeoutBlock !== undefined ? { timeoutBlock: h.timeoutBlock.toString() } : {}),
      }));
      return JSON.stringify(wire);
    },
    peel(envelope) {
      let parsed: WireHop[];
      try {
        parsed = JSON.parse(envelope) as WireHop[];
      } catch {
        return { kind: 'final' };
      }
      if (!Array.isArray(parsed) || parsed.length === 0) return { kind: 'final' };
      const [head, ...rest] = parsed;
      const next: ForwardHop = {
        via: head.to,
        amount: BigInt(head.amount),
        tokenId: head.tokenId,
        ...(head.channelId ? { channelId: head.channelId } : {}),
        ...(head.timeoutBlock ? { timeoutBlock: BigInt(head.timeoutBlock) } : {}),
      };
      return rest.length > 0
        ? { kind: 'forward', next, onward: JSON.stringify(rest) }
        : { kind: 'forward', next };
    },
  };
}
