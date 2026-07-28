/**
 * Sensor bridge for @totemsdk/edge-mqtt.
 *
 * Maps MQTT sensor messages into canonical proof inputs.
 * Supports Uint8Array, string, and JSON payloads — does not assume JSON.
 */

import { computeMqttEventId } from './canonical.js';
import { createMqttReceipt, publishMqttReceipt } from './receipts.js';
import type { MqttMessage, MqttClientPort } from './client-port.js';
import type {
  MqttSensorBridgeConfig,
  MqttSensorBridge,
  MqttSensorBinding,
  MqttProofPublisher,
} from './types.js';

function parsePayload(payload: Uint8Array | string): unknown {
  const text =
    payload instanceof Uint8Array ? new TextDecoder().decode(payload) : payload;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export function createMqttSensorBridge(config: MqttSensorBridgeConfig): MqttSensorBridge {
  const unsubscribeFns: Array<() => void> = [];

  return {
    async start(): Promise<void> {
      const client: MqttClientPort | undefined = config.client ?? (config.gateway as unknown as { client?: MqttClientPort }).client;
      if (!client) return;

      for (const binding of config.bindings) {
        await client.subscribe(binding.inputTopic);
        const unsub = client.onMessage(async (message: MqttMessage) => {
          if (message.topic === binding.inputTopic) {
            await this.handleSensorMessage(binding, message);
          }
        });
        unsubscribeFns.push(unsub);
      }
    },

    async stop(): Promise<void> {
      for (const fn of unsubscribeFns) fn();
      unsubscribeFns.length = 0;
    },

    async handleMessage(message: MqttMessage): Promise<void> {
      for (const binding of config.bindings) {
        if (message.topic === binding.inputTopic) {
          await this.handleSensorMessage(binding, message);
        }
      }
    },

    async handleSensorMessage(binding: MqttSensorBinding, message: MqttMessage): Promise<void> {
      const parsedPayload = parsePayload(message.payload);
      const eventId = computeMqttEventId({ sensorId: binding.sensorId, topic: message.topic, receivedAt: message.receivedAt });

      const proofPublisher: MqttProofPublisher | undefined =
        config.proofPublisher ?? (config.gateway as unknown as { proofPublisher?: MqttProofPublisher }).proofPublisher;

      if (proofPublisher) {
        try {
          const envelope = await proofPublisher.createProofFromMessage(message, {
            subjectId: `sensor:${binding.sensorId}`,
            subjectKind: binding.subjectType ?? 'sensor',
            metadata: {
              sensorId: binding.sensorId,
              dataType: binding.dataType ?? 'sensor-reading',
              parsedPayload,
            },
          });

          const proofTopic = binding.proofTopic;
          if (proofTopic) {
            await proofPublisher.publishProof(envelope, proofTopic);
          } else {
            await proofPublisher.publishProof(envelope);
          }

          const receiptTopic = binding.receiptTopic;
          if (receiptTopic) {
            await proofPublisher.publishProofReceipt(envelope, receiptTopic);
          } else {
            await proofPublisher.publishProofReceipt(envelope);
          }
        } catch (err: unknown) {
          const deadLetterQueue = config.deadLetterQueue;
          if (deadLetterQueue) {
            await deadLetterQueue.enqueue({
              topic: binding.proofTopic ?? binding.inputTopic,
              payload: message.payload,
              receivedAt: message.receivedAt,
              eventId,
              error: err instanceof Error ? err.message : String(err),
            } as any);
          } else {
            console.error(
              `[sensor-bridge] Proof failed for sensor ${binding.sensorId} on topic ${message.topic}:`,
              err,
            );
          }
        }
      }

      const client: MqttClientPort | undefined = config.client ?? (config.gateway as unknown as { client?: MqttClientPort }).client;
      if (client && binding.receiptTopic) {
        const receipt = createMqttReceipt({
          kind: 'proof',
          payload: { eventId, sensorId: binding.sensorId, topic: message.topic },
        });
        await publishMqttReceipt(client, receipt, binding.receiptTopic);
      }
    },
  };
}
