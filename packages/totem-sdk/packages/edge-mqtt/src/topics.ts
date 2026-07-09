/**
 * Topic helpers for @totemsdk/edge-mqtt.
 *
 * Provides default topic sets and MQTT wildcard matching (+ and #).
 */

import type { MqttTopicSet, MqttTopicMatch } from './types.js';

export function createDefaultMqttTopics(deviceId: string): MqttTopicSet {
  return {
    status: `totem/${deviceId}/status`,
    manifest: `totem/${deviceId}/manifest`,
    proofs: `totem/${deviceId}/proofs`,
    receipts: `totem/${deviceId}/receipts`,
    payments: `totem/${deviceId}/payments`,
    commands: `totem/${deviceId}/commands`,
    errors: `totem/${deviceId}/errors`,
  };
}

export function createSensorTopic(
  deviceId: string,
  sensorId: string,
  kind: 'raw' | 'proof' | 'receipt'
): string {
  return `sensors/${deviceId}/${sensorId}/${kind}`;
}

/**
 * Match an MQTT topic pattern against a concrete topic.
 * Supports + (single-level) and # (multi-level, must be last segment).
 */
export function matchMqttTopic(pattern: string, topic: string): MqttTopicMatch {
  const patternSegments = pattern.split('/');
  const topicSegments = topic.split('/');

  const params: Record<string, string> = {};
  let pi = 0;
  let ti = 0;

  while (pi < patternSegments.length && ti < topicSegments.length) {
    const p = patternSegments[pi];
    const t = topicSegments[ti];

    if (p === '#') {
      params['#'] = topicSegments.slice(ti).join('/');
      return { matched: true, params };
    } else if (p === '+') {
      params[`+${pi}`] = t;
      pi++;
      ti++;
    } else if (p === t) {
      pi++;
      ti++;
    } else {
      return { matched: false };
    }
  }

  if (pi === patternSegments.length && ti === topicSegments.length) {
    return { matched: true, params };
  }

  if (pi < patternSegments.length && patternSegments[pi] === '#') {
    params['#'] = '';
    return { matched: true, params };
  }

  return { matched: false };
}
