/**
 * Proof publisher for @totemsdk/edge-mqtt.
 *
 * Modes:
 *   'edge-port'    — delegates to runtime.ports.proof.createProof (default).
 *                     The port is responsible for signing.
 *   'proof-package' — uses createProof() + signProof() / signWithLease() from
 *                      @totemsdk/proof directly when config.seed is provided.
 *
 * Both modes bind the raw MQTT payload bytes (as an evidence hash) into the
 * proof so that payload tampering invalidates the WOTS signature.
 *
 * In proof-package mode a WOTS lease provider should be wired to prevent
 * key-index reuse across concurrent signing operations or restarts.
 */

import { createProof, signProof, signWithLease, toHex, sha3_256 } from '@totemsdk/proof';
import type { UnsignedProof, SignedProof } from '@totemsdk/proof';
import { canonicalJson, computeMqttEventId } from './canonical.js';
import type { MqttMessage } from './client-port.js';
import type {
  MqttProofPublisherConfig,
  MqttProofPublisher,
  MqttProofOptions,
  MqttProofEnvelope,
} from './types.js';

function rawPayloadEvidence(rawPayload: Uint8Array | string): { id: string; kind: string; hash: string } {
  const bytes = typeof rawPayload === 'string' ? new TextEncoder().encode(rawPayload) : rawPayload;
  const hash = toHex(sha3_256(bytes));
  return { id: 'payload:' + hash, kind: 'raw-payload', hash };
}

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
        // Delegate to the edge port — pass rawPayload in context so the
        // adapter can bind it into the proof as evidence.
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
          context: {
            ...(options?.metadata ?? {}),
            rawPayload: message.payload,
          },
        });
        if (result.ok && result.data) {
          proof = result.data.proof;
          proofId = result.data.proofId;
        }
      } else if (proofMode === 'proof-package') {
        const subjectId = options?.subjectId ?? message.topic;
        const issuer = config.issuer ?? config.runtime.deviceId ?? 'unknown';

        // Bind raw MQTT payload bytes as evidence so any tampering
        // invalidates the WOTS signature.
        const payloadEvidence = rawPayloadEvidence(message.payload);

        const unsigned: UnsignedProof = createProof({
          kind: (options?.metadata?.proofKind as string ?? 'mqtt-sensor') as import('@totemsdk/proof').ProofKind,
          subject: {
            id: subjectId,
            kind: (options?.subjectKind ?? options?.metadata?.subjectKind ?? 'sensor') as import('@totemsdk/proof').ProofSubject['kind'],
          },
          issuer,
          evidence: [payloadEvidence],
          payload: {
            topic: message.topic,
            receivedAt: message.receivedAt,
            rawPayloadHash: payloadEvidence.hash,
            ...(options?.metadata !== undefined ? { metadata: options.metadata } : {}),
          },
        });

        // Sign the proof if seed is available — otherwise only an
        // UnsignedProof is returned, which MUST NOT be presented as
        // a completed proof.
        if (config.seed) {
          if (config.leaseProvider) {
            proof = await signWithLease(unsigned, config.seed, config.leaseProvider, {
              treeId: config.leaseTreeId,
            });
          } else {
            proof = signProof(unsigned, config.seed, config.keyIndex ?? 0);
          }
          proofId = (proof as SignedProof).proofId;
        } else {
          proof = unsigned;
          proofId = unsigned.proofId;
        }
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
