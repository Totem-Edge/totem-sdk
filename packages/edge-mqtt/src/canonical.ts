/**
 * Canonical helpers and message codec for @totemsdk/edge-mqtt.
 *
 * Delegates to Rust/WASM for deterministic JSON canonicalization,
 * SHA3-256 event ID computation, and binary message encode/decode.
 */

export {
  toHex,
  canonicalJson,
  computeMqttEventId,
  encodeMqttEdgeMessage,
  decodeMqttEdgeMessage,
} from './wasm-sync.js';
