/**
 * Synchronous WASM bridge for @totemsdk/edge-mqtt.
 *
 * Delegates canonicalization, topic matching, and fixed-point arithmetic
 * to Rust/WASM. All functions are synchronous.
 */

import {
  to_hex,
  canonical_json,
  compute_mqtt_event_id,
  encode_mqtt_edge_message,
  decode_mqtt_edge_message,
  create_default_mqtt_topics,
  create_sensor_topic,
  match_mqtt_topic,
  to_scaled,
  from_scaled,
  add_decimal,
  compare_decimal,
  is_over_limit,
} from '../rust/pkg/edge_mqtt_wasm.js';

// Canonical
export const toHex = to_hex;
export const canonicalJson = (value: unknown): string => canonical_json(value as any);
export const computeMqttEventId = (event: unknown): string => compute_mqtt_event_id(event as any);

// Message codec
export const encodeMqttEdgeMessage = (message: {
  topic: string;
  payload: Uint8Array | string;
  receivedAt: number;
  qos?: 0 | 1 | 2;
  retain?: boolean;
  properties?: Record<string, unknown>;
}): Uint8Array => {
  const payloadStr = typeof message.payload === 'string' ? message.payload : undefined;
  const payloadBytes = message.payload instanceof Uint8Array ? message.payload : undefined;
  return encode_mqtt_edge_message(
    message.topic,
    payloadStr ?? null,
    payloadBytes ?? null,
    message.receivedAt,
    message.qos ?? null,
    message.retain ?? null,
    message.properties ?? null,
  );
};

export const decodeMqttEdgeMessage = (bytes: Uint8Array): any => {
  return decode_mqtt_edge_message(bytes);
};

// Topics
export const createDefaultMqttTopics = create_default_mqtt_topics;
export const createSensorTopic = create_sensor_topic;
export const matchMqttTopic = match_mqtt_topic;

// Fixed-point arithmetic
export const toScaled = to_scaled;
export const fromScaled = from_scaled;
export const addDecimal = add_decimal;
export const compareDecimal = compare_decimal;
export const isOverLimit = is_over_limit;
