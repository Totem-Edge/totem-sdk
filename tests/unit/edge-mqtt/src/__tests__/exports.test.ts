import * as edgeMqtt from '../index.js';

describe('exports.test — root exports work', () => {
  it('exports createMqttEdgeGateway', () => {
    expect(typeof edgeMqtt.createMqttEdgeGateway).toBe('function');
  });
  it('exports createMqttSensorBridge', () => {
    expect(typeof edgeMqtt.createMqttSensorBridge).toBe('function');
  });
  it('exports createMqttProofPublisher', () => {
    expect(typeof edgeMqtt.createMqttProofPublisher).toBe('function');
  });
  it('exports createMqttCommandHandler', () => {
    expect(typeof edgeMqtt.createMqttCommandHandler).toBe('function');
  });
  it('exports createMqttUsageMeter', () => {
    expect(typeof edgeMqtt.createMqttUsageMeter).toBe('function');
  });
  it('exports createMqttCreditGate', () => {
    expect(typeof edgeMqtt.createMqttCreditGate).toBe('function');
  });
  it('exports createMemoryMqttEdgeQueue', () => {
    expect(typeof edgeMqtt.createMemoryMqttEdgeQueue).toBe('function');
  });
  it('exports flushQueuedEvents', () => {
    expect(typeof edgeMqtt.flushQueuedEvents).toBe('function');
  });
  it('exports createDeadLetterEvent', () => {
    expect(typeof edgeMqtt.createDeadLetterEvent).toBe('function');
  });
  it('exports createDefaultMqttTopics', () => {
    expect(typeof edgeMqtt.createDefaultMqttTopics).toBe('function');
  });
  it('exports createSensorTopic', () => {
    expect(typeof edgeMqtt.createSensorTopic).toBe('function');
  });
  it('exports matchMqttTopic', () => {
    expect(typeof edgeMqtt.matchMqttTopic).toBe('function');
  });
  it('exports createMqttRuleEngine', () => {
    expect(typeof edgeMqtt.createMqttRuleEngine).toBe('function');
  });
  it('exports findMatchingRules', () => {
    expect(typeof edgeMqtt.findMatchingRules).toBe('function');
  });
  it('exports routeMqttMessage', () => {
    expect(typeof edgeMqtt.routeMqttMessage).toBe('function');
  });
  it('exports createMqttEdgeServiceManifest', () => {
    expect(typeof edgeMqtt.createMqttEdgeServiceManifest).toBe('function');
  });
  it('exports publishMqttManifest', () => {
    expect(typeof edgeMqtt.publishMqttManifest).toBe('function');
  });
  it('exports announceMqttService', () => {
    expect(typeof edgeMqtt.announceMqttService).toBe('function');
  });
  it('exports mirrorMqttToRealtime', () => {
    expect(typeof edgeMqtt.mirrorMqttToRealtime).toBe('function');
  });
  it('exports createMqttReceipt', () => {
    expect(typeof edgeMqtt.createMqttReceipt).toBe('function');
  });
  it('exports publishMqttReceipt', () => {
    expect(typeof edgeMqtt.publishMqttReceipt).toBe('function');
  });
  it('exports encodeMqttEdgeMessage', () => {
    expect(typeof edgeMqtt.encodeMqttEdgeMessage).toBe('function');
  });
  it('exports decodeMqttEdgeMessage', () => {
    expect(typeof edgeMqtt.decodeMqttEdgeMessage).toBe('function');
  });
  it('exports typed errors', () => {
    expect(typeof edgeMqtt.MqttEdgeError).toBe('function');
    expect(typeof edgeMqtt.MqttClientUnavailableError).toBe('function');
    expect(typeof edgeMqtt.MqttPolicyRejectedError).toBe('function');
    expect(typeof edgeMqtt.MqttPaymentRequiredError).toBe('function');
    expect(typeof edgeMqtt.MqttCreditExceededError).toBe('function');
    expect(typeof edgeMqtt.MqttProofCreationError).toBe('function');
    expect(typeof edgeMqtt.MqttQueueError).toBe('function');
  });
});
