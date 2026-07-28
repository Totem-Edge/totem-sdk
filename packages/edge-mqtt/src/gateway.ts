/**
 * MQTT Edge Gateway for @totemsdk/edge-mqtt.
 *
 * Dispatch rule: uses only injected handlers/bridges/publishers from config.
 * Does NOT instantiate proof, payment, command, or sensor subsystems implicitly.
 * If no handler is supplied, those message types are silently dropped.
 *
 * transport is stored as metadata only — never used to open a connection.
 */

import { createDefaultMqttTopics } from './topics.js';
import { createMqttRuleEngine, routeMqttMessage } from './rules.js';
import type { MqttMessage } from './client-port.js';
import type {
  MqttEdgeGatewayConfig,
  MqttEdgeGateway,
  MqttGatewayStatus,
  MqttTopicSet,
  MqttRuleEngine,
} from './types.js';

export function createMqttEdgeGateway(config: MqttEdgeGatewayConfig): MqttEdgeGateway {
  const topics: MqttTopicSet = {
    ...createDefaultMqttTopics(config.deviceId),
    ...(config.topics ?? {}),
  };

  const engine: MqttRuleEngine = config.rules
    ? createMqttRuleEngine(config.rules)
    : { rules: [] };

  let running = false;
  let connectedAt: number | undefined;
  let stoppedAt: number | undefined;
  let unsubscribeHandler: (() => void) | undefined;

  const gateway: MqttEdgeGateway = {
    async start(): Promise<void> {
      if (running) return;

      if (config.client.connect) {
        await config.client.connect();
      }

      unsubscribeHandler = config.client.onMessage(
        (message: MqttMessage) => gateway.handleMessage(message)
      );

      const uniqueTopics = new Set<string>();
      for (const rule of engine.rules) {
        uniqueTopics.add(rule.topicPattern);
      }
      for (const t of uniqueTopics) {
        await config.client.subscribe(t);
      }

      running = true;
      connectedAt = Date.now();
      stoppedAt = undefined;

      await gateway.publishStatus();
    },

    async stop(): Promise<void> {
      if (!running) return;
      running = false;
      stoppedAt = Date.now();

      if (unsubscribeHandler) {
        unsubscribeHandler();
        unsubscribeHandler = undefined;
      }

      if (config.client.disconnect) {
        await config.client.disconnect();
      }

      await gateway.publishStatus();
    },

    status(): MqttGatewayStatus {
      return {
        deviceId: config.deviceId,
        running,
        connectedAt,
        stoppedAt,
        transport: config.transport,
        metadata: config.metadata,
      };
    },

    async publishStatus(): Promise<void> {
      const s = gateway.status();
      await config.client.publish(topics.status, JSON.stringify(s));
    },

    async publishManifest(): Promise<void> {
      if (!config.manifest) return;
      await config.client.publish(topics.manifest, JSON.stringify(config.manifest));
    },

    async handleMessage(message: MqttMessage): Promise<void> {
      const decisions = routeMqttMessage(engine, message);

      for (const decision of decisions) {
        const { rule } = decision;

        if (rule.kind === 'command' && config.commandHandler) {
          await config.commandHandler.handleCommand(message);
        } else if (rule.kind === 'proof' && config.proofPublisher) {
          const envelope = await config.proofPublisher.createProofFromMessage(message);
          await config.proofPublisher.publishProof(envelope);
        }
      }

      if (config.sensorBridge) {
        await config.sensorBridge.handleMessage(message);
      }
    },
  };

  return gateway;
}
