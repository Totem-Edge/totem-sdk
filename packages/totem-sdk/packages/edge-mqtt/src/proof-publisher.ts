/**
 * Proof publisher for @totemsdk/edge-mqtt.
 *
 * Modes:
 *   'edge-port'    — delegates to runtime.ports.proof.createProof (default).
 *   'proof-package' — uses createProof() from @totemsdk/proof directly when
 *                      signing material is injected (subject + issuer). Does not
 *                      manage WOTS key lease internally.
 *
 * Neither mode touches WOTS key reservation or wallet-level key management.
 */

import { createProof } from '@totemsdk/proof';
import { canonicalJson, toHex, computeMqttEventId } from './canonical.js';
import { sha3_256 } from '@totemsdk/core';
import type { MqttMessage } from './client-port.js';
import type {
  MqttProofPublisherConfig,
  MqttProofPublisher,
  MqttProofOptions,
  MqttProofEnvelope,
} from './types.js';

export function createMqttProofPublisher(config: MqttProofPublisherConfig): MqttProofPublisher {
  const proofMode = config.proofMode ?? 'edge-port';

  return {
    async createProofFromMessage(
      message: MqttMessage,
      options?: MqttProofOptions
    ): Promise<MqttProofEnvelope> {
      const envelopeId = computeMqttEventId({ topic: message.topic, receivedAt: message.receivedAt });
      const createdAt = Date.now();

      let proof: unknown;
      let proofId: string | undefined;

      if (proofMode === 'edge-port' && config.runtime.ports.proof) {
        const subject = options?.subjectId ?? message.topic;
        const result = await config.runtime.ports.proof.createProof({
          subject,
          claims: [
            {
              topic: message.topic,
              receivedAt: message.receivedAt,
              dataType: options?.metadata?.dataType ?? 'mqtt-message',
            },
          ],
          context: options?.metadata,
        });
        if (result.ok && result.data) {
          proof = result.data.proof;
          proofId = result.data.proofId;
        }
      } else if (proofMode === 'proof-package') {
        const subjectId = options?.subjectId ?? message.topic;
        const issuer = config.issuer ?? config.runtime.deviceId ?? 'unknown';

        const unsignedProof = createProof({
          kind: (options?.metadata?.proofKind as string ?? 'mqtt-sensor') as import('@totemsdk/proof').ProofKind,
          subject: {
            id: subjectId,
            kind: (options?.subjectKind ?? options?.metadata?.subjectKind ?? 'sensor') as import('@totemsdk/proof').ProofSubject['kind'],
          },
          issuer,
          payload: {
            topic: message.topic,
            receivedAt: message.receivedAt,
            ...(options?.metadata !== undefined ? { metadata: options.metadata } : {}),
          },
        });

        proof = unsignedProof;
        proofId = unsignedProof.proofId;
      }

      return {
        envelopeId,
        topic: message.topic,
        message,
        proof,
        proofId,
        createdAt,
        metadata: options?.metadata,
      };
    },

    async publishProof(envelope: MqttProofEnvelope, topic?: string): Promise<void> {
      const target = topic ?? config.defaultProofTopic;
      await config.client.publish(target, canonicalJson({
        envelopeId: envelope.envelopeId,
        topic: envelope.topic,
        proof: envelope.proof,
        proofId: envelope.proofId,
        createdAt: envelope.createdAt,
      }));
    },

    async publishProofReceipt(envelope: MqttProofEnvelope, topic?: string): Promise<void> {
      const target = topic ?? config.defaultReceiptTopic ?? `${config.defaultProofTopic}/receipts`;
      await config.client.publish(target, canonicalJson({
        envelopeId: envelope.envelopeId,
        proofId: envelope.proofId,
        topic: envelope.topic,
        createdAt: envelope.createdAt,
        metadata: envelope.metadata,
      }));
    },
  };
}
