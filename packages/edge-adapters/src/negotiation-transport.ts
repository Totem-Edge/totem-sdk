/**
 * negotiation-transport.ts — NegotiationTransport adapters over Edge ports.
 *
 * Two adapters:
 *   - createStreamNegotiationTransport: raw byte stream (EdgeStreamPort).
 *     Messages are framed as length-prefixed JSON. The sender address is
 *     resolved by the caller (the stream is a single authenticated peer).
 *   - createPubSubNegotiationTransport: topic-based (EdgePubSubPort).
 *     Each negotiation uses a topic derived from the negotiationId; the
 *     sender address is carried in the envelope.
 *
 * Transport metadata stays separate from economic protocol objects. The
 * NegotiationEngine never sees sockets/topics/connection IDs.
 */

import type { NegotiationMessage, NegotiationTransport, TransportMessageContext } from '@totemsdk/edge';
import type { EdgePubSubPort, EdgeStreamPort } from '@totemsdk/edge';

// ─────────────────────────────────────────────────────────────────────────────
// Stream adapter
// ─────────────────────────────────────────────────────────────────────────────

export interface StreamNegotiationTransportConfig {
  stream: EdgeStreamPort;
  /** The authenticated sender address for this stream (resolved by caller). */
  sender: string;
  /** The local recipient address. */
  recipient: string;
  /** Max message size in bytes (default 64 KiB). */
  maxBytes?: number;
}

/**
 * Create a NegotiationTransport over a raw byte stream.
 *
 * Messages are framed as `[4-byte BE length][JSON bytes]`. The stream is
 * assumed to be a single authenticated peer connection, so the sender address
 * is fixed by the caller.
 */
export function createStreamNegotiationTransport(
  config: StreamNegotiationTransportConfig,
): NegotiationTransport {
  const { stream, sender, recipient } = config;
  const maxBytes = config.maxBytes ?? 64 * 1024;

  return {
    async send(_recipient, message) {
      const bytes = new TextEncoder().encode(JSON.stringify(message));
      if (bytes.length > maxBytes) {
        throw new Error(`negotiation message exceeds ${maxBytes} bytes`);
      }
      const frame = new Uint8Array(4 + bytes.length);
      new DataView(frame.buffer).setUint32(0, bytes.length);
      frame.set(bytes, 4);
      stream.send(frame);
    },
    subscribe(handler) {
      let buffer: Uint8Array = new Uint8Array(0);
      const off = stream.onData((chunk) => {
        buffer = concatBytes(buffer, chunk);
        while (buffer.length >= 4) {
          const view = new DataView(buffer.buffer, buffer.byteOffset, 4);
          const len = view.getUint32(0);
          if (buffer.length < 4 + len) break;
          const payload = buffer.slice(4, 4 + len);
          buffer = buffer.slice(4 + len);
          try {
            const message = JSON.parse(new TextDecoder().decode(payload)) as NegotiationMessage;
            void handler(message, { sender, recipient });
          } catch {
            // Malformed frame — drop.
          }
        }
      });
      return off;
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PubSub adapter
// ─────────────────────────────────────────────────────────────────────────────

export interface PubSubNegotiationTransportConfig {
  pubsub: EdgePubSubPort;
  /** The local recipient address. */
  recipient: string;
  /** Topic prefix (default 'totem.negotiation'). */
  topicPrefix?: string;
  /** Max message size in bytes (default 64 KiB). */
  maxBytes?: number;
}

function topicFor(topicPrefix: string, negotiationId: string): string {
  return `${topicPrefix}.${negotiationId}`;
}

/**
 * Create a NegotiationTransport over a pub/sub transport.
 *
 * Each negotiation uses a topic derived from its negotiationId. The sender
 * address is carried in the envelope (a `sender` field on the message), so
 * the ingress pipeline can authenticate it.
 */
export function createPubSubNegotiationTransport(
  config: PubSubNegotiationTransportConfig,
): NegotiationTransport {
  const { pubsub, recipient } = config;
  const topicPrefix = config.topicPrefix ?? 'totem.negotiation';
  const maxBytes = config.maxBytes ?? 64 * 1024;

  return {
    async send(recipientAddress, message) {
      const negotiationId = (message as { negotiationId?: string }).negotiationId;
      if (!negotiationId) throw new Error('negotiation message missing negotiationId');
      const topic = topicFor(topicPrefix, negotiationId);
      const envelope = { ...message, sender: recipientAddress, recipient };
      const bytes = new TextEncoder().encode(JSON.stringify(envelope));
      if (bytes.length > maxBytes) {
        throw new Error(`negotiation message exceeds ${maxBytes} bytes`);
      }
      await pubsub.publish(topic, bytes);
    },
    subscribe(handler) {
      return pubsub.onMessage(({ topic, payload }) => {
        if (!topic.startsWith(topicPrefix)) return;
        try {
          const envelope = JSON.parse(new TextDecoder().decode(payload)) as NegotiationMessage & {
            sender?: string;
            recipient?: string;
          };
          const sender = envelope.sender ?? 'unknown';
          void handler(envelope, { sender, recipient });
        } catch {
          // Malformed message — drop.
        }
      });
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}