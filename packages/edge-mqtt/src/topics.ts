/**
 * Topic helpers for @totemsdk/edge-mqtt.
 *
 * Delegates to Rust/WASM for MQTT wildcard matching and topic construction.
 */

export {
  createDefaultMqttTopics,
  createSensorTopic,
  matchMqttTopic,
} from './wasm-sync.js';
