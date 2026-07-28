/**
 * Topic rule engine for @totemsdk/edge-mqtt.
 */

import { matchMqttTopic } from './topics.js';
import type { MqttTopicRule, MqttRuleEngine, MqttRouteDecision, MqttRouteRule } from './types.js';
import type { MqttMessage } from './client-port.js';

export function createMqttRuleEngine(rules: MqttTopicRule[]): MqttRuleEngine {
  return { rules: rules.filter((r) => r.enabled !== false) };
}

export function findMatchingRules(engine: MqttRuleEngine, topic: string): MqttTopicRule[] {
  return engine.rules.filter((rule) => matchMqttTopic(rule.topicPattern, topic).matched);
}

export function routeMqttMessage(engine: MqttRuleEngine, message: MqttMessage): MqttRouteDecision[] {
  const matching = findMatchingRules(engine, message.topic);
  return matching.map((rule) => {
    const routeRule = rule as Partial<MqttRouteRule>;
    return {
      rule,
      message,
      ...(routeRule.outputTopic !== undefined ? { outputTopic: routeRule.outputTopic } : {}),
    };
  });
}
