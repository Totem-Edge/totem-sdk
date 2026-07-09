import {
  createMqttRuleEngine,
  findMatchingRules,
  routeMqttMessage,
} from '../rules.js';
import type { MqttTopicRule } from '../types.js';
import type { MqttMessage } from '../client-port.js';

const proofRule: MqttTopicRule = {
  id: 'proof-rule',
  kind: 'proof',
  topicPattern: 'sensors/+/+/raw',
  enabled: true,
};

const paymentRule: MqttTopicRule = {
  id: 'payment-rule',
  kind: 'payment',
  topicPattern: 'totem/+/payments',
  enabled: true,
};

const commandRule: MqttTopicRule = {
  id: 'command-rule',
  kind: 'command',
  topicPattern: 'totem/+/commands',
  enabled: true,
};

const disabledRule: MqttTopicRule = {
  id: 'disabled-rule',
  kind: 'custom',
  topicPattern: 'sensors/#',
  enabled: false,
};

const makeMessage = (topic: string): MqttMessage => ({
  topic,
  payload: '{}',
  receivedAt: Date.now(),
});

describe('rules.test — rule engine matching', () => {
  it('createMqttRuleEngine excludes disabled rules', () => {
    const engine = createMqttRuleEngine([proofRule, disabledRule]);
    expect(engine.rules).toHaveLength(1);
    expect(engine.rules[0].id).toBe('proof-rule');
  });

  it('findMatchingRules matches proof rule on sensor topic', () => {
    const engine = createMqttRuleEngine([proofRule, paymentRule, commandRule]);
    const matches = findMatchingRules(engine, 'sensors/dev-1/temp/raw');
    expect(matches.some((r) => r.id === 'proof-rule')).toBe(true);
    expect(matches.some((r) => r.id === 'payment-rule')).toBe(false);
  });

  it('findMatchingRules matches payment rule on payments topic', () => {
    const engine = createMqttRuleEngine([proofRule, paymentRule, commandRule]);
    const matches = findMatchingRules(engine, 'totem/device-1/payments');
    expect(matches.some((r) => r.id === 'payment-rule')).toBe(true);
    expect(matches.some((r) => r.id === 'proof-rule')).toBe(false);
  });

  it('findMatchingRules matches command rule on commands topic', () => {
    const engine = createMqttRuleEngine([proofRule, paymentRule, commandRule]);
    const matches = findMatchingRules(engine, 'totem/device-1/commands');
    expect(matches.some((r) => r.id === 'command-rule')).toBe(true);
  });

  it('routeMqttMessage returns route decisions', () => {
    const engine = createMqttRuleEngine([proofRule]);
    const message = makeMessage('sensors/dev-1/temp/raw');
    const decisions = routeMqttMessage(engine, message);
    expect(decisions).toHaveLength(1);
    expect(decisions[0].rule.id).toBe('proof-rule');
    expect(decisions[0].message.topic).toBe('sensors/dev-1/temp/raw');
  });

  it('routeMqttMessage returns empty when no rules match', () => {
    const engine = createMqttRuleEngine([proofRule]);
    const decisions = routeMqttMessage(engine, makeMessage('unknown/topic'));
    expect(decisions).toHaveLength(0);
  });
});
