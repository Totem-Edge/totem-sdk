/**
 * purchasing/transport.ts — Authenticated P2P negotiation transport boundary.
 *
 * NegotiationEngine = deterministic economic state machine.
 * NegotiationTransport = message delivery.
 *
 * Transport must NOT decide whether an offer is economically acceptable,
 * whether a negotiation is exhausted, or whether a proposal becomes an
 * agreement. The engine must NOT know about sockets, MQTT topics, peer
 * connections, or network retry implementation.
 *
 * Adapters may target EdgeStreamPort, EdgePubSubPort, edge-mqtt, or a future
 * Maxima adapter.
 */

import type { NegotiationMessage } from './types.js';

/**
 * A durable delivery receipt.
 *
 * Means ONLY: "the remote machine durably received/claimed this exact logical
 * message (messageId)". It does NOT mean "I accept your economic proposal" —
 * that is ProposalAcceptance. Never conflate the two.
 */
export interface DeliveryReceipt {
  messageId: string;
  /** Epoch ms when the remote durably processed (claimed) the message. */
  receivedAt: number;
  /** Always true — a receipt is only produced after durable processing. */
  durablyProcessed: true;
}

/** Context passed to the transport handler for an inbound message. */
export interface TransportMessageContext {
  /** The authenticated sender address (resolved by the transport). */
  sender: string;
  /** The local recipient address. */
  recipient: string;
  /** Transport-level metadata (e.g. topic, connection id). */
  metadata?: Record<string, unknown>;
}

export type Unsubscribe = () => void;

/**
 * Authenticated negotiation transport boundary.
 *
 * `send` returns a DeliveryReceipt when the transport can prove the remote
 * machine durably received/claimed the message (request/response or a durable
 * acknowledgement), or `undefined` when the transport is fire-and-forget
 * (e.g. pub/sub) and cannot prove durable remote processing. The outbox
 * drainer must NOT mark a message delivered when `undefined` is returned —
 * local transmission is not durable delivery.
 */
export interface NegotiationTransport {
  send(recipient: string, message: NegotiationMessage): Promise<DeliveryReceipt | undefined>;
  subscribe(
    handler: (
      message: NegotiationMessage,
      context: TransportMessageContext,
    ) => Promise<void>,
  ): Unsubscribe | Promise<Unsubscribe>;
}

/**
 * Deterministic in-memory transport for tests and local/programmatic
 * negotiation. Delivers messages synchronously to subscribed handlers, and
 * returns a DeliveryReceipt when the handler is present (durably delivered).
 */
export class InMemoryNegotiationTransport implements NegotiationTransport {
  private readonly handlers: Array<
    (message: NegotiationMessage, context: TransportMessageContext) => Promise<void>
  > = [];
  private readonly sent: Array<{ recipient: string; message: NegotiationMessage }> = [];

  async send(recipient: string, message: NegotiationMessage): Promise<DeliveryReceipt | undefined> {
    this.sent.push({ recipient, message });
    for (const handler of this.handlers) {
      await handler(message, { sender: 'local', recipient });
    }
    // The in-memory transport durably delivers synchronously.
    const id = (await import('./messages.js')).messageId(message);
    return { messageId: id, receivedAt: Date.now(), durablyProcessed: true };
  }

  subscribe(
    handler: (
      message: NegotiationMessage,
      context: TransportMessageContext,
    ) => Promise<void>,
  ): Unsubscribe {
    this.handlers.push(handler);
    return () => {
      const idx = this.handlers.indexOf(handler);
      if (idx >= 0) this.handlers.splice(idx, 1);
    };
  }

  /** Inspect delivered messages (for tests). */
  getSent(): Array<{ recipient: string; message: NegotiationMessage }> {
    return [...this.sent];
  }
}
