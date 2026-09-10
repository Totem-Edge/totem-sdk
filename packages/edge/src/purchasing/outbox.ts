/**
 * purchasing/outbox.ts — Durable outbox for the persist-then-send crash window.
 *
 * The classic distributed-systems hazard:
 *
 *   persist state → send network message
 *
 * If the process crashes between persistence and send, the counterparty may
 * wait forever. Doing it in the opposite order (send then persist) is equally
 * bad. The durable outbox closes this window:
 *
 *   atomic durable transition
 *     NEGOTIATING v7
 *          ↓
 *     AGREED v8
 *     +
 *     OUTBOX: ProposalAcceptance(messageId=X)
 *          ↓ commit
 *     transport worker
 *          ↓
 *     send X
 *          ↓
 *     mark X delivered
 *
 * On restart: scan undelivered outbox → resend the SAME signed message with
 * the SAME messageId → the remote replay ledger handles duplicates.
 *
 * This composes with the CAS state machine, the durable replay claim, and
 * stable message identity to give effectively-once economic protocol semantics
 * over at-least-once transport.
 */

import type { NegotiationMessage } from './types.js';

/** An outbound message awaiting delivery. */
export interface OutboxEntry {
  /** Stable canonical message ID (recomputed, never trusted from the wire). */
  messageId: string;
  /** The recipient address. */
  recipient: string;
  /** The signed message to deliver. */
  message: NegotiationMessage;
  /** When the entry was enqueued. */
  enqueuedAt: number;
  /** When the message was delivered (undefined = undelivered). */
  deliveredAt?: number;
  /** Delivery attempt count (bounded retry budget). */
  attempts: number;
}

/** A durable outbox store. */
export interface OutboxStore {
  /** Atomically enqueue an outbound message. */
  enqueue(entry: OutboxEntry): Promise<void>;
  /** List undelivered entries (for resend on restart). */
  listUndelivered(): Promise<OutboxEntry[]>;
  /** Mark a message as delivered. */
  markDelivered(messageId: string, deliveredAt: number): Promise<void>;
  /** Increment the delivery attempt count. */
  recordAttempt(messageId: string): Promise<void>;
}

/** In-memory outbox (dev/test). */
export class InMemoryOutboxStore implements OutboxStore {
  private readonly entries = new Map<string, OutboxEntry>();

  async enqueue(entry: OutboxEntry): Promise<void> {
    this.entries.set(entry.messageId, entry);
  }

  async listUndelivered(): Promise<OutboxEntry[]> {
    return [...this.entries.values()].filter((e) => e.deliveredAt === undefined);
  }

  async markDelivered(messageId: string, deliveredAt: number): Promise<void> {
    const entry = this.entries.get(messageId);
    if (entry) this.entries.set(messageId, { ...entry, deliveredAt });
  }

  async recordAttempt(messageId: string): Promise<void> {
    const entry = this.entries.get(messageId);
    if (entry) this.entries.set(messageId, { ...entry, attempts: entry.attempts + 1 });
  }
}
