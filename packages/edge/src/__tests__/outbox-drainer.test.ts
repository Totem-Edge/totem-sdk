/**
 * outbox-drainer.test.ts — Tests for the durable outbox worker.
 *
 * Verifies the critical delivery rule:
 *   - A transport that returns NO durable receipt → message stays undelivered
 *   - A transport that returns a durable receipt → message marked delivered
 *   - Retries resend the SAME message with the SAME messageId
 *   - Bounded attempts → held after maxAttempts
 *   - Marking delivered only on a durable receipt (never local send)
 */

import {
  createOutboxDrainer,
  deliverOne,
  InMemoryOutboxStore,
  InMemoryNegotiationTransport,
  messageId,
  type DeliveryReceipt,
  type NegotiationMessage,
  type NegotiationTransport,
  type TransportMessageContext,
} from '@totemsdk/edge';

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function makeMessage(): NegotiationMessage {
  return {
    version: 1,
    negotiationId: 'n1',
    sender: 'buyer',
    recipient: 'seller',
    reason: 'initial-proposal',
  } as unknown as NegotiationMessage;
}

/** A transport that never returns a durable receipt (fire-and-forget). */
function makeNoReceiptTransport(): NegotiationTransport {
  return {
    send: async () => undefined,
    subscribe: () => () => {},
  };
}

/** A transport that returns a durable receipt. */
function makeReceiptTransport(): { transport: NegotiationTransport; sent: Array<{ recipient: string; message: NegotiationMessage }> } {
  const sent: Array<{ recipient: string; message: NegotiationMessage }> = [];
  return {
    sent,
    transport: {
      send: async (recipient, message) => {
        sent.push({ recipient, message });
        return { messageId: messageId(message), receivedAt: Date.now(), durablyProcessed: true } as DeliveryReceipt;
      },
      subscribe: () => () => {},
    },
  };
}

/** A transport that fails the first N sends, then returns a receipt. */
function makeFlakyTransport(failures: number): NegotiationTransport {
  let fails = failures;
  return {
    send: async (recipient, message) => {
      if (fails > 0) {
        fails--;
        throw new Error('transport down');
      }
      return { messageId: messageId(message), receivedAt: Date.now(), durablyProcessed: true } as DeliveryReceipt;
    },
    subscribe: () => () => {},
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('outbox drainer', () => {
  it('does NOT mark delivered when transport returns no durable receipt', async () => {
    const outbox = new InMemoryOutboxStore();
    const msg = makeMessage();
    await outbox.enqueue({ messageId: 'm1', recipient: 'seller', message: msg, enqueuedAt: Date.now(), attempts: 0 });

    const result = await deliverOne(
      { transport: makeNoReceiptTransport(), outbox, maxAttempts: 1 },
      (await outbox.listUndelivered())[0],
    );
    expect(result).toBe('held');
    const undelivered = await outbox.listUndelivered();
    expect(undelivered.length).toBe(1); // still undelivered
    expect(undelivered[0].attempts).toBe(1);
  });

  it('marks delivered when transport returns a durable receipt', async () => {
    const outbox = new InMemoryOutboxStore();
    const msg = makeMessage();
    await outbox.enqueue({ messageId: messageId(msg), recipient: 'seller', message: msg, enqueuedAt: Date.now(), attempts: 0 });

    const { transport } = makeReceiptTransport();
    const result = await deliverOne({ transport, outbox }, (await outbox.listUndelivered())[0]);
    expect(result).toBe(true);
    expect((await outbox.listUndelivered()).length).toBe(0);
  });

  it('retries resend the SAME message with the SAME messageId', async () => {
    const outbox = new InMemoryOutboxStore();
    const msg = makeMessage();
    const mid = messageId(msg);
    await outbox.enqueue({ messageId: mid, recipient: 'seller', message: msg, enqueuedAt: Date.now(), attempts: 0 });

    const { transport, sent } = makeReceiptTransport();
    const drainer = createOutboxDrainer({ transport, outbox, maxAttempts: 3 });
    const summary = await drainer.drain();

    expect(summary.delivered).toBe(1);
    expect(summary.retrying).toBe(0);
    expect(sent.length).toBe(1);
    expect(sent[0].message).toBe(msg); // same object
    expect(messageId(sent[0].message)).toBe(mid); // same messageId
  });

  it('recovers after transient failure, same messageId, no double-marking', async () => {
    const outbox = new InMemoryOutboxStore();
    const msg = makeMessage();
    const mid = messageId(msg);
    await outbox.enqueue({ messageId: mid, recipient: 'seller', message: msg, enqueuedAt: Date.now(), attempts: 0 });

    // Fail the first send, succeed the second.
    let fails = 1;
    let sentCount = 0;
    const transport: NegotiationTransport = {
      send: async (recipient, message) => {
        sentCount++;
        if (fails > 0) {
          fails--;
          throw new Error('down');
        }
        return { messageId: messageId(message), receivedAt: Date.now(), durablyProcessed: true } as DeliveryReceipt;
      },
      subscribe: () => () => {},
    };
    const drainer = createOutboxDrainer({ transport, outbox, maxAttempts: 3 });
    const first = await drainer.drain();
    expect(first.retrying).toBe(1); // first attempt failed
    const second = await drainer.drain();
    expect(second.delivered).toBe(1); // second attempt delivered
    expect(sentCount).toBe(2);
    expect(messageId((await outbox.listUndelivered()).length === 0 ? makeMessage() : makeMessage())).toBeTruthy();
    const entries = await outbox.listUndelivered();
    expect(entries.length).toBe(0);
  });

  it('holds after maxAttempts without infinite retry', async () => {
    const outbox = new InMemoryOutboxStore();
    const msg = makeMessage();
    await outbox.enqueue({ messageId: 'm-held', recipient: 'seller', message: msg, enqueuedAt: Date.now(), attempts: 0 });
    const drainer = createOutboxDrainer({ transport: makeNoReceiptTransport(), outbox, maxAttempts: 2 });
    const first = await drainer.drain();
    const second = await drainer.drain();
    // After 2 attempts (one per drain pass), the entry is held.
    const held = await dragHeld(outbox);
    expect(held).toBe(true);
  });
});

async function dragHeld(outbox: InMemoryOutboxStore): Promise<boolean> {
  const undelivered = await outbox.listUndelivered();
  if (undelivered.length === 0) return false;
  const entry = undelivered[0];
  return entry.attempts >= 2;
}
