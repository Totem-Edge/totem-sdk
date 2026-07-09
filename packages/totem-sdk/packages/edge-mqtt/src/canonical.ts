/**
 * Canonical helpers and message codec for @totemsdk/edge-mqtt.
 *
 * encodeMqttEdgeMessage / decodeMqttEdgeMessage allow other packages (Pear apps,
 * Axia relays, and alternative transport bridges) to carry MQTT-shaped messages over arbitrary
 * transports without @totemsdk/edge-mqtt depending on those transports.
 */

import { sha3_256 } from '@noble/hashes/sha3.js';
import type { MqttMessage } from './client-port.js';

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_, v) => {
    if (v === undefined) return undefined;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      return Object.fromEntries(
        Object.keys(v as Record<string, unknown>)
          .sort()
          .map((k) => [k, (v as Record<string, unknown>)[k]])
      );
    }
    return v as unknown;
  });
}

export function computeMqttEventId(event: unknown): string {
  const json = canonicalJson(event);
  const hash = sha3_256(new TextEncoder().encode(json));
  return `mqtt:event:${toHex(hash)}`;
}

/**
 * Encode an MqttMessage to bytes for transport over Pear, Axia, or any
 * other channel. Payload is represented as a base64 string when it is a
 * Uint8Array, or as-is when it is a string.
 */
export function encodeMqttEdgeMessage(message: MqttMessage): Uint8Array {
  const payload =
    message.payload instanceof Uint8Array
      ? { __type: 'bytes', data: Buffer.from(message.payload).toString('base64') }
      : message.payload;

  const obj = {
    topic: message.topic,
    payload,
    receivedAt: message.receivedAt,
    ...(message.qos !== undefined ? { qos: message.qos } : {}),
    ...(message.retain !== undefined ? { retain: message.retain } : {}),
    ...(message.properties !== undefined ? { properties: message.properties } : {}),
  };
  return new TextEncoder().encode(canonicalJson(obj));
}

/**
 * Decode bytes produced by encodeMqttEdgeMessage back into an MqttMessage.
 * Throws MqttEdgeError when required fields are missing.
 */
export function decodeMqttEdgeMessage(bytes: Uint8Array): MqttMessage {
  const text = new TextDecoder().decode(bytes);
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error('decodeMqttEdgeMessage: invalid JSON');
  }

  if (typeof obj.topic !== 'string') {
    throw new Error('decodeMqttEdgeMessage: missing or invalid field "topic"');
  }
  if (typeof obj.receivedAt !== 'number') {
    throw new Error('decodeMqttEdgeMessage: missing or invalid field "receivedAt"');
  }
  if (obj.payload === undefined) {
    throw new Error('decodeMqttEdgeMessage: missing field "payload"');
  }

  let payload: Uint8Array | string;
  const rawPayload = obj.payload as Record<string, unknown>;
  if (
    rawPayload !== null &&
    typeof rawPayload === 'object' &&
    rawPayload.__type === 'bytes' &&
    typeof rawPayload.data === 'string'
  ) {
    payload = new Uint8Array(Buffer.from(rawPayload.data, 'base64'));
  } else {
    payload = typeof obj.payload === 'string' ? obj.payload : JSON.stringify(obj.payload);
  }

  return {
    topic: obj.topic,
    payload,
    receivedAt: obj.receivedAt,
    ...(typeof obj.qos === 'number' ? { qos: obj.qos as 0 | 1 | 2 } : {}),
    ...(typeof obj.retain === 'boolean' ? { retain: obj.retain } : {}),
    ...(obj.properties !== undefined ? { properties: obj.properties as Record<string, unknown> } : {}),
  };
}
