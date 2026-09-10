/**
 * purchasing/messages.ts — Canonical message identity and replay ledger.
 *
 * Every state-changing P2P message needs a stable canonical identity so that
 * transport retries are idempotent. A replayed identical message must return
 * or reconstruct the same prior result — never a second economic action.
 */

import { sha3_256 } from '@totemsdk/core';
import { canonicalJson, toHex } from '../canonical.js';
import type { NegotiationMessage } from './types.js';

/** Canonical message type discriminator. */
export function messageType(msg: NegotiationMessage): string {
  if ('proposalId' in msg && 'terms' in msg) return 'TradeProposal';
  if ('challenge' in msg && 'reason' in msg) return 'WorkRequired';
  if ('acceptedAt' in msg) return 'ProposalAcceptance';
  if ('rejectedAt' in msg) return 'ProposalRejection';
  if ('cancelledAt' in msg) return 'NegotiationCancellation';
  if ('requestedAt' in msg) return 'NegotiationRequest';
  return 'Unknown';
}

/**
 * Compute the canonical message ID for a state-changing message.
 *
 * Binds: protocol version, message type, negotiationId, proposalId /
 * parentProposalId where relevant, sender, recipient, timestamp, and payload
 * hash. The ID is recomputed deterministically — never trusted from the wire.
 */
export function messageId(msg: NegotiationMessage): string {
  const type = messageType(msg);
  const canonical = canonicalJson({
    version: (msg as { version?: number }).version,
    type,
    negotiationId: (msg as { negotiationId?: string }).negotiationId,
    proposalId: (msg as { proposalId?: string }).proposalId,
    parentProposalId: (msg as { parentProposalId?: string }).parentProposalId,
    sender: (msg as { sender?: string; proposer?: string; acceptor?: string; rejector?: string }).sender
      ?? (msg as { proposer?: string }).proposer
      ?? (msg as { acceptor?: string }).acceptor
      ?? (msg as { rejector?: string }).rejector,
    recipient: (msg as { recipient?: string }).recipient,
    timestamp: (msg as { createdAt?: number; acceptedAt?: number; rejectedAt?: number; cancelledAt?: number; requestedAt?: number }).createdAt
      ?? (msg as { acceptedAt?: number }).acceptedAt
      ?? (msg as { rejectedAt?: number }).rejectedAt
      ?? (msg as { cancelledAt?: number }).cancelledAt
      ?? (msg as { requestedAt?: number }).requestedAt,
    payloadHash: payloadHash(msg),
  });
  return toHex(sha3_256(new TextEncoder().encode(canonical)));
}

/** Canonical payload hash of a message (excluding signature fields). */
function payloadHash(msg: NegotiationMessage): string {
  const { signature, signerPublicKey, ...rest } = msg as unknown as Record<string, unknown>;
  return toHex(sha3_256(new TextEncoder().encode(canonicalJson(rest))));
}

/**
 * Replay outcome — the durable result of processing a message.
 */
export interface ReplayOutcome {
  ok: boolean;
  result?: string;
  error?: string;
}

/**
 * A durable replay entry.
 *
 * Processing claims are recoverable: if a claim is never completed (process
 * crash), the lease expires and the message may be reclaimed safely. The
 * engine's CAS/idempotency protection makes reclamation safe.
 */
export type ReplayEntry =
  | {
      state: 'PROCESSING';
      claimedAt: number;
      /** When the processing lease expires. After this, the claim may be reclaimed. */
      leaseUntil?: number;
    }
  | {
      state: 'COMPLETED';
      outcome: ReplayOutcome;
      completedAt: number;
    };

/**
 * Replay ledger — persists enough information to answer
 * "have I already processed this exact signed message?"
 *
 * The `claim` operation is ATOMIC: two identical messages arriving
 * concurrently cannot both observe "not present" before either records the
 * result. Exactly one caller wins the claim; the other takes the replay path.
 *
 * If a claim is PROCESSING past its lease, a subsequent claim reclaims it
 * (safe because the engine's negotiate CAS is idempotency-protected).
 */
export interface ReplayLedger {
  /**
   * Atomically claim a message for processing. Returns `{ claimed: true }`
   * when this caller won the claim, `{ claimed: false, outcome }` when the
   * message was already completed, or `{ claimed: true, reclaimed: true }`
   * when a stale lease was reclaimed.
   */
  claim(
    messageId: string,
    receivedAt: number,
    leaseMs?: number,
  ): Promise<
    | { claimed: true; reclaimed?: boolean }
    | { claimed: false; entry?: ReplayEntry }
  >;
  /** Mark a claimed message as durably processed with its outcome. */
  complete(messageId: string, outcome: ReplayOutcome): Promise<void>;
  /** Look up a previously processed message. */
  get(messageId: string): Promise<ReplayEntry | undefined>;
}

/** In-memory replay ledger (dev/test). Atomic within a single process. */
export class InMemoryReplayLedger implements ReplayLedger {
  private readonly entries = new Map<string, ReplayEntry>();

  async claim(
    messageId: string,
    receivedAt: number,
    leaseMs = 30_000,
  ): Promise<
    | { claimed: true; reclaimed?: boolean }
    | { claimed: false; entry?: ReplayEntry }
  > {
    const existing = this.entries.get(messageId);
    if (existing) {
      if (existing.state === 'COMPLETED') {
        return { claimed: false, entry: existing };
      }
      // PROCESSING — reclaim if the lease expired.
      if (existing.leaseUntil !== undefined && receivedAt > existing.leaseUntil) {
        this.entries.set(messageId, {
          state: 'PROCESSING',
          claimedAt: receivedAt,
          leaseUntil: receivedAt + leaseMs,
        });
        return { claimed: true, reclaimed: true };
      }
      return { claimed: false, entry: existing };
    }
    this.entries.set(messageId, {
      state: 'PROCESSING',
      claimedAt: receivedAt,
      leaseUntil: receivedAt + leaseMs,
    });
    return { claimed: true };
  }

  async complete(messageId: string, outcome: ReplayOutcome): Promise<void> {
    this.entries.set(messageId, {
      state: 'COMPLETED',
      outcome,
      completedAt: Date.now(),
    });
  }

  async get(messageId: string): Promise<ReplayEntry | undefined> {
    return this.entries.get(messageId);
  }
}
