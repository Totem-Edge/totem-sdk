/**
 * @module @totemsdk/edge-mqtt
 *
 * MQTT adapter for Totem Edge — transport-agnostic bridge for sensors, gateways,
 * robots, cold-chain trackers, and MachinePay devices.
 *
 * This package does not import mqtt.js, net, tls, ws, http, fs, or browser APIs.
 * All network behavior is injected via MqttClientPort.
 */

export type {
  MqttClientPort,
  MqttMessage,
  MqttPublishOptions,
  MqttSubscribeOptions,
  MqttSubscription,
} from './client-port.js';

export type {
  MqttTransportKind,
  MqttTransportInfo,
  MqttTopicSet,
  MqttTopicMatch,
  MqttRuleKind,
  MqttTopicRule,
  MqttProofRule,
  MqttPaymentRule,
  MqttCommandRule,
  MqttRouteRule,
  MqttRouteDecision,
  MqttRuleEngine,
  MqttEdgeGatewayConfig,
  MqttEdgeGateway,
  MqttGatewayStatus,
  MqttSensorBinding,
  MqttSensorBridgeConfig,
  MqttSensorBridge,
  MqttProofPublisherConfig,
  MqttProofPublisher,
  MqttProofOptions,
  MqttProofEnvelope,
  MqttCommand,
  MqttCommandExecutor,
  MqttCommandHandlerConfig,
  MqttCommandHandler,
  MqttUsageUnit,
  MqttUsageEvent,
  MqttUsageMeterConfig,
  MqttUsageMeter,
  MqttCreditGateConfig,
  MqttCreditGate,
  MqttCreditDecision,
  MqttQueuedEvent,
  MqttEdgeQueue,
  RealtimePort,
} from './types.js';

export {
  MqttEdgeError,
  MqttClientUnavailableError,
  MqttPolicyRejectedError,
  MqttPaymentRequiredError,
  MqttCreditExceededError,
  MqttProofCreationError,
  MqttQueueError,
} from './errors.js';

export {
  createDefaultMqttTopics,
  createSensorTopic,
  matchMqttTopic,
} from './topics.js';

export {
  createMqttRuleEngine,
  findMatchingRules,
  routeMqttMessage,
} from './rules.js';

export { createMqttEdgeGateway } from './gateway.js';

export { createMqttSensorBridge } from './sensor-bridge.js';

export { createMqttProofPublisher } from './proof-publisher.js';

export { createMqttCommandHandler } from './command-handler.js';

export { createMqttUsageMeter } from './usage-meter.js';

export { createMqttCreditGate } from './credit-gate.js';

export {
  createMemoryMqttEdgeQueue,
  flushQueuedEvents,
  createDeadLetterEvent,
} from './queue.js';

export {
  createMqttEdgeServiceManifest,
  publishMqttManifest,
} from './manifest.js';

export type { MqttEdgeServiceManifestInput, MqttServiceType } from './manifest.js';

export { announceMqttService, announceToAll } from './lookup.js';

export { mirrorMqttToRealtime } from './realtime.js';

export { createMqttReceipt, publishMqttReceipt } from './receipts.js';

export type { MqttReceiptInput } from './receipts.js';

export {
  toHex,
  canonicalJson,
  computeMqttEventId,
  encodeMqttEdgeMessage,
  decodeMqttEdgeMessage,
} from './canonical.js';

export {
  createEdgeRuntime,
  createEdgeReceipt,
  verifyEdgeReceipt,
} from '@totemsdk/edge';
