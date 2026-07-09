/**
 * Policy-gated command handler for @totemsdk/edge-mqtt.
 *
 * Uses runtime.ports.policy.check if available.
 * Delegates execution to injected MqttCommandExecutor only.
 * Never executes commands directly without an injected executor.
 */

import { MqttPolicyRejectedError } from './errors.js';
import { createMqttReceipt, publishMqttReceipt } from './receipts.js';
import type { MqttMessage } from './client-port.js';
import type { EdgeOperationResult } from '@totemsdk/edge';
import type { MqttCommandHandlerConfig, MqttCommandHandler, MqttCommand } from './types.js';

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
    commandId: String(body.commandId ?? `cmd-${Date.now()}`),
    command: String(body.command ?? 'unknown'),
    payload: body.payload,
    requestedBy: body.requestedBy !== undefined ? String(body.requestedBy) : undefined,
    createdAt: typeof body.createdAt === 'number' ? body.createdAt : Date.now(),
  };
}

export function createMqttCommandHandler(config: MqttCommandHandlerConfig): MqttCommandHandler {
  return {
    async handleCommand(message: MqttMessage): Promise<EdgeOperationResult> {
      const command = parseCommand(message);
      const receiptTopic = config.receiptTopic ?? `totem/${config.runtime.deviceId}/receipts`;

      const policyPort = config.runtime.ports.policy;
      if (policyPort) {
        const decision = await policyPort.check({
          action: command.command,
          subject: command.requestedBy ?? 'unknown',
          context: { commandId: command.commandId, topic: message.topic },
        });

        if (!decision.ok || (decision.data && !decision.data.allowed)) {
          const reason = decision.data?.reason ?? decision.error ?? 'Policy denied';
          const receipt = createMqttReceipt({
            kind: 'command',
            payload: { commandId: command.commandId, status: 'rejected', reason },
          });
          await publishMqttReceipt(config.client, receipt, receiptTopic);
          return { ok: false, error: reason, errorCode: 'MQTT_POLICY_REJECTED' };
        }
      }

      if (!config.executor) {
        const receipt = createMqttReceipt({
          kind: 'command',
          payload: { commandId: command.commandId, status: 'no-executor' },
        });
        await publishMqttReceipt(config.client, receipt, receiptTopic);
        return { ok: false, error: 'No command executor injected', errorCode: 'NO_EXECUTOR' };
      }

      const result = await config.executor.execute(command);

      const receipt = createMqttReceipt({
        kind: 'command',
        payload: {
          commandId: command.commandId,
          status: result.ok ? 'executed' : 'failed',
          error: result.error,
        },
      });
      await publishMqttReceipt(config.client, receipt, receiptTopic);

      return result;
    },
  };
}
