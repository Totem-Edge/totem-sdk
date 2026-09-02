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
 */
export interface ReplayEntry {
  messageId: string;
  /** When the message was first claimed. */
  claimedAt: number;
  /** When processing completed (undefined while in-flight). */
  completedAt?: number;
  outcome?: ReplayOutcome;
}

/**
 * Replay ledger — persists enough information to answer
 * "have I already processed this exact signed message?"
 *
 * The `claim` operation is ATOMIC: two identical messages arriving
 * concurrently cannot both observe "not present" before either records the
 * result. Exactly one caller wins the claim; the other takes the replay path.
 */
export interface ReplayLedger {
  /**
   * Atomically claim a message for processing. Returns `{ claimed: true }`
   * when this caller won the claim, or `{ claimed: false, outcome }` when the
   * message was already claimed/completed (replay path).
   */
  claim(
    messageId: string,
    receivedAt: number,
  ): Promise<{ claimed: true } | { claimed: false; outcome?: ReplayOutcome }>;
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
  ): Promise<{ claimed: true } | { claimed: false; outcome?: ReplayOutcome }> {
    const existing = this.entries.get(messageId);
    if (existing) {
      return { claimed: false, outcome: existing.outcome };
    }
    this.entries.set(messageId, { messageId, claimedAt: receivedAt });
    return { claimed: true };
  }

  async complete(messageId: string, outcome: ReplayOutcome): Promise<void> {
    const existing = this.entries.get(messageId);
    if (!existing) {
      this.entries.set(messageId, { messageId, claimedAt: Date.now(), completedAt: Date.now(), outcome });
      return;
    }
    this.entries.set(messageId, { ...existing, completedAt: Date.now(), outcome });
  }

  async get(messageId: string): Promise<ReplayEntry | undefined> {
    return this.entries.get(messageId);
  }
}
