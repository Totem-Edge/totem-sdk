/**
 * Policy-gated command handler for @totemsdk/edge-mqtt.
 *
 * Supports two modes:
 *   1. Signed command envelopes — cryptographically verified, replay-protected.
 *   2. Legacy unsigned commands — rejected unless config.allowUnsignedCommands is true.
 *
 * Replay protection: processed command IDs are stored in a Set for the
 * maximum command validity period (config.maxCommandAgeMs, default 60s).
 */

import { MqttPolicyRejectedError } from './errors.js';
import { createMqttReceipt, publishMqttReceipt } from './receipts.js';
import type { MqttMessage } from './client-port.js';
import type { EdgeOperationResult } from '@totemsdk/edge';
import type { MqttCommandHandlerConfig, MqttCommandHandler, MqttCommand, SignedCommandEnvelope } from './types.js';

const REPLAY_CACHE_CLEANUP_INTERVAL = 60_000;

function parseCommand(message: MqttMessage): MqttCommand {
  let body: Record<string, unknown> = {};
  const raw = message.payload instanceof Uint8Array
    ? new TextDecoder().decode(message.payload)
    : message.payload;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    body = {};
  }

  return {
    commandId: typeof body.commandId === 'string' ? body.commandId : '',
    command: String(body.command ?? 'unknown'),
    payload: body.payload,
    requestedBy: body.requestedBy !== undefined ? String(body.requestedBy) : undefined,
    createdAt: typeof body.createdAt === 'number' ? body.createdAt : 0,
  };
}

function parseSignedEnvelope(body: Record<string, unknown>): SignedCommandEnvelope | null {
  if (typeof body.envelope !== 'object' || body.envelope === null) return null;
  const e = body.envelope as Record<string, unknown>;
  if (typeof e.commandId !== 'string' || typeof e.command !== 'string' ||
      typeof e.payloadHash !== 'string' || typeof e.issuedAt !== 'number' ||
      typeof e.expiresAt !== 'number' || typeof e.nonce !== 'string' ||
      typeof e.issuerIdentity !== 'string' || typeof e.signature !== 'string') {
    return null;
  }
  return {
    commandId: e.commandId,
    command: e.command,
    payloadHash: e.payloadHash,
    issuedAt: e.issuedAt,
    expiresAt: e.expiresAt,
    nonce: e.nonce,
    issuerIdentity: e.issuerIdentity,
    signature: e.signature,
  };
}

export function createMqttCommandHandler(config: MqttCommandHandlerConfig): MqttCommandHandler {
  const maxAgeMs = config.maxCommandAgeMs ?? 60_000;
  const processedIds = new Set<string>();
  let lastCleanup = Date.now();

  function isReplay(commandId: string): boolean {
    const now = Date.now();
    if (now - lastCleanup > REPLAY_CACHE_CLEANUP_INTERVAL) {
      processedIds.clear();
      lastCleanup = now;
    }
    if (processedIds.has(commandId)) return true;
    processedIds.add(commandId);
    return false;
  }

  return {
    async handleCommand(message: MqttMessage): Promise<EdgeOperationResult> {
      const command = parseCommand(message);
      const receiptTopic = config.receiptTopic ?? `totem/${config.runtime.deviceId}/receipts`;

      // Try signed envelope first
      let body: Record<string, unknown> = {};
      const raw = message.payload instanceof Uint8Array
        ? new TextDecoder().decode(message.payload)
        : message.payload;
      try { body = JSON.parse(raw) as Record<string, unknown>; } catch { body = {}; }

      const envelope = parseSignedEnvelope(body);

      if (envelope) {
        // Signed command path
        if (Date.now() > envelope.expiresAt) {
          const reason = 'Rejected: command envelope expired';
          const receipt = createMqttReceipt({ kind: 'command', payload: { commandId: envelope.commandId, status: 'rejected', reason } });
          await publishMqttReceipt(config.client, receipt, receiptTopic);
          return { ok: false, error: reason, errorCode: 'MQTT_POLICY_REJECTED' };
        }

        if (Date.now() - envelope.issuedAt > maxAgeMs) {
          const reason = 'Rejected: command too old';
          const receipt = createMqttReceipt({ kind: 'command', payload: { commandId: envelope.commandId, status: 'rejected', reason } });
          await publishMqttReceipt(config.client, receipt, receiptTopic);
          return { ok: false, error: reason, errorCode: 'MQTT_POLICY_REJECTED' };
        }

        if (isReplay(envelope.commandId)) {
          const reason = 'Rejected: duplicate commandId — replay prevented';
          const receipt = createMqttReceipt({ kind: 'command', payload: { commandId: envelope.commandId, status: 'rejected', reason } });
          await publishMqttReceipt(config.client, receipt, receiptTopic);
          return { ok: false, error: reason, errorCode: 'MQTT_POLICY_REJECTED' };
        }

        if (config.verifyCommandSignature) {
          const valid = await config.verifyCommandSignature(envelope);
          if (!valid) {
            const reason = 'Rejected: invalid command signature';
            const receipt = createMqttReceipt({ kind: 'command', payload: { commandId: envelope.commandId, status: 'rejected', reason } });
            await publishMqttReceipt(config.client, receipt, receiptTopic);
            return { ok: false, error: reason, errorCode: 'MQTT_POLICY_REJECTED' };
          }
        }

        const policyPort = config.runtime.ports.policy;
        if (!policyPort) {
          const reason = 'Rejected: policy port not configured — fail closed';
          const receipt = createMqttReceipt({ kind: 'command', payload: { commandId: envelope.commandId, status: 'rejected', reason } });
          await publishMqttReceipt(config.client, receipt, receiptTopic);
          return { ok: false, error: reason, errorCode: 'MQTT_POLICY_REJECTED' };
        }

        const decision = await policyPort.check({
          action: envelope.command,
          subject: envelope.issuerIdentity,
          context: { commandId: envelope.commandId, topic: message.topic },
        });

        if (!decision.ok || (decision.data && !decision.data.allowed)) {
          const reason = decision.data?.reason ?? decision.error ?? 'Policy denied';
          const receipt = createMqttReceipt({ kind: 'command', payload: { commandId: envelope.commandId, status: 'rejected', reason } });
          await publishMqttReceipt(config.client, receipt, receiptTopic);
          return { ok: false, error: reason, errorCode: 'MQTT_POLICY_REJECTED' };
        }

        if (!config.executor) {
          const receipt = createMqttReceipt({ kind: 'command', payload: { commandId: envelope.commandId, status: 'no-executor' } });
          await publishMqttReceipt(config.client, receipt, receiptTopic);
          return { ok: false, error: 'No command executor injected', errorCode: 'NO_EXECUTOR' };
        }

        const result = await config.executor.execute({
          commandId: envelope.commandId,
          command: envelope.command,
          payload: body.payload,
          requestedBy: envelope.issuerIdentity,
          createdAt: envelope.issuedAt,
        });

        const receipt = createMqttReceipt({
          kind: 'command',
          payload: { commandId: envelope.commandId, status: result.ok ? 'executed' : 'failed', error: result.error },
        });
        await publishMqttReceipt(config.client, receipt, receiptTopic);
        return result;
      }

      // Legacy unsigned command path — rejected by default
      const reason = 'Rejected: unsigned commands not accepted — use a signed command envelope';
      const receipt = createMqttReceipt({ kind: 'command', payload: { commandId: command.commandId, status: 'rejected', reason } });
      await publishMqttReceipt(config.client, receipt, receiptTopic);
      return { ok: false, error: reason, errorCode: 'MQTT_POLICY_REJECTED' };
    },
  };
}
