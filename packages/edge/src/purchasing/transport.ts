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

/** Authenticated negotiation transport boundary. */
export interface NegotiationTransport {
  send(recipient: string, message: NegotiationMessage): Promise<void>;
  subscribe(
    handler: (
      message: NegotiationMessage,
      context: TransportMessageContext,
    ) => Promise<void>,
  ): Unsubscribe | Promise<Unsubscribe>;
}

/**
 * Deterministic in-memory transport for tests and local/programmatic
 * negotiation. Delivers messages synchronously to subscribed handlers.
 */
export class InMemoryNegotiationTransport implements NegotiationTransport {
  private readonly handlers: Array<
    (message: NegotiationMessage, context: TransportMessageContext) => Promise<void>
  > = [];
  private readonly sent: Array<{ recipient: string; message: NegotiationMessage }> = [];

  async send(recipient: string, message: NegotiationMessage): Promise<void> {
    this.sent.push({ recipient, message });
    for (const handler of this.handlers) {
      await handler(message, { sender: 'local', recipient });
    }
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
