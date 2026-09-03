/**
 * purchasing/outbox-drainer.ts — Bounded durable outbox worker.
 *
 * Drains undelivered outbox messages: resend the SAME stored message with the
 * SAME messageId, wait for a transport-level durable receipt, then mark
 * delivered. On failure, record an attempt and back off. On restart, scan
 * undelivered and resume.
 *
 * CRITICAL delivery rule: an outbox entry is marked delivered ONLY when the
 * transport returns a DeliveryReceipt proving the remote machine durably
 * received/processed the same logical message. Socket.write() / MQTT publish()
 * / queued bytes are NOT durable delivery.
 *
 * Delivery receipt ≠ economic acceptance. A receipt means "I durably received
 * message X", never "I accept your proposal".
 */

import type { DeliveryReceipt, NegotiationTransport } from './transport.js';
import type { OutboxEntry, OutboxStore } from './outbox.js';

export interface OutboxDrainerOptions {
  /** The transport used to deliver outbox messages. */
  transport: NegotiationTransport;
  /** The durable outbox store. */
  outbox: OutboxStore;
  /** Max delivery attempts per message (default 5). Beyond this the entry is held. */
  maxAttempts?: number;
  /** Base backoff ms between attempts (default 1_000). */
  backoffBaseMs?: number;
  /** Max backoff ms (default 30_000). */
  backoffMaxMs?: number;
  /** Optional event hook for observability. */
  onEvent?: (event: { type: 'negotiation.message_sent' | 'negotiation.delivery_retried'; messageId: string; attempts: number }) => void;
}

/**
 * Deliver one outbox message and mark it delivered only on a durable receipt.
 * Returns true when delivered, false when retry needed, 'held' when the retry
 * budget is exhausted.
 */
export async function deliverOne(
  opts: OutboxDrainerOptions,
  entry: OutboxEntry,
): Promise<boolean | 'held'> {
  const maxAttempts = opts.maxAttempts ?? 5;

  try {
    const receipt: DeliveryReceipt | undefined = await opts.transport.send(
      entry.recipient,
      entry.message,
    );

    if (receipt && receipt.durablyProcessed && receipt.messageId) {
      await opts.outbox.markDelivered(entry.messageId, Date.now());
      opts.onEvent?.({ type: 'negotiation.message_sent', messageId: entry.messageId, attempts: entry.attempts });
      return true;
    }

    // No durable receipt — record attempt, back off, retry.
    await opts.outbox.recordAttempt(entry.messageId);
    const attempts = entry.attempts + 1;
    opts.onEvent?.({ type: 'negotiation.delivery_retried', messageId: entry.messageId, attempts });
    if (attempts >= maxAttempts) return 'held';
    return false;
  } catch {
    await opts.outbox.recordAttempt(entry.messageId);
    const attempts = entry.attempts + 1;
    if (attempts >= maxAttempts) return 'held';
    return false;
  }
}

/**
 * Create a bounded outbox drain worker.
 *
 * Returns:
 *   - `drain()`: attempt all undelivered messages (one pass, bounded attempts).
 *   - `start()`/`stop()`: a simple interval loop (caller controls cadence).
 *   - `resume()`: drain undelivered on restart.
 */
export function createOutboxDrainer(opts: OutboxDrainerOptions) {
  let timer: ReturnType<typeof setInterval> | null = null;

  async function drain(): Promise<{ delivered: number; retrying: number; held: number }> {
    const undelivered = await opts.outbox.listUndelivered();
    let delivered = 0;
    let retrying = 0;
    let held = 0;
    for (const entry of undelivered) {
      const result = await deliverOne(opts, entry);
      if (result === true) delivered++;
      else if (result === false) retrying++;
      else held++;
    }
    return { delivered, retrying, held };
  }

  function start(intervalMs = 5_000): void {
    if (timer) return;
    timer = setInterval(() => {
      void drain();
    }, intervalMs);
  }

  function stop(): void {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  return { drain, start, stop, resume: drain };
}

export type OutboxDrainer = ReturnType<typeof createOutboxDrainer>;
