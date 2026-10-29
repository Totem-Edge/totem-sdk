/**
 * Policy-gated command handler for @totemsdk/edge-mqtt.
 *
 * Supports two modes:
 *   1. Signed command envelopes — cryptographically verified, payload-bound,
 *      replay-protected. This is the default and fail-closed path.
 *   2. Legacy unsigned commands — parsed from the raw body and passed through
 *      the same policy + executor pipeline (verification skipped). Available
 *      only when `config.requireSignedCommands === false` on trusted networks.
 *
 * Replay claims are atomic and retained through the command's maximum valid
 * acceptance time. A configured replayStore must provide durable atomic claims
 * across all handlers/processes for the device. Without it claims are local to
 * this handler and are lost on restart.
 */

import { createMqttReceipt, publishMqttReceipt } from './receipts.js';
import { canonicalJson, toHex } from './canonical.js';
import { sha3_256 } from '@totemsdk/proof';
import type { MqttMessage } from './client-port.js';
import type { EdgeOperationResult } from '@totemsdk/edge';
import type {
  MqttCommandHandlerConfig,
  MqttCommandHandler,
  MqttCommand,
  ReplayLedgerStore,
  SignedCommandEnvelope,
} from './types.js';

const REPLAY_VALIDITY_MS = 60_000;
const REPLAY_LEDGER_PREFIX = 'totem_mqtt_replay:';

function parseBody(raw: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(raw);
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function parseCommand(message: MqttMessage): MqttCommand {
  const raw = message.payload instanceof Uint8Array
    ? new TextDecoder().decode(message.payload)
    : message.payload;
  const body = parseBody(raw);

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

class ReplayLedger {
  private readonly seen = new Map<string, number>();

  constructor(
    private readonly deviceId: string,
    private readonly store?: ReplayLedgerStore,
  ) {}

  private key(id: string): string {
    return `${REPLAY_LEDGER_PREFIX}${JSON.stringify([this.deviceId, id])}`;
  }

  /** Claims before any policy/executor await. No claims are released on errors. */
  async claim(commandId: string, expiresAt: number, now: number): Promise<boolean> {
    if (this.store) return this.store.claim(this.key(commandId), expiresAt, now);
    for (const [id, expiry] of this.seen) {
      if (expiry < now) this.seen.delete(id);
    }
    const previous = this.seen.get(commandId);
    if (previous !== undefined && previous >= now) return false;
    // No await between lookup and insertion: concurrent deliveries cannot both win.
    this.seen.set(commandId, expiresAt);
    return true;
  }
}

export function createMqttCommandHandler(config: MqttCommandHandlerConfig): MqttCommandHandler {
  const maxAgeMs = config.maxCommandAgeMs ?? REPLAY_VALIDITY_MS;
  if (!Number.isSafeInteger(maxAgeMs) || maxAgeMs <= 0) {
    throw new Error('maxCommandAgeMs must be a positive safe integer');
  }
  if (config.replayStore && typeof config.replayStore.claim !== 'function') {
    throw new Error('replayStore must provide an atomic durable claim operation');
  }
  const ledger = new ReplayLedger(config.runtime.deviceId, config.replayStore);

  return {
    async handleCommand(message: MqttMessage): Promise<EdgeOperationResult> {
      const receiptTopic = config.receiptTopic ?? `totem/${config.runtime.deviceId}/receipts`;

      const emitRejected = async (commandId: string, reason: string): Promise<void> => {
        const receipt = createMqttReceipt({ kind: 'command', payload: { commandId, status: 'rejected', reason } });
        await publishMqttReceipt(config.client, receipt, receiptTopic);
      };

      // Parse envelope (signed) or legacy unsigned command body.
      const raw = message.payload instanceof Uint8Array
        ? new TextDecoder().decode(message.payload)
        : message.payload;
      const body = parseBody(raw);

      const envelope = parseSignedEnvelope(body);
      const requireSignedCommands = config.requireSignedCommands !== false;

      // Fail closed: unsigned or malformed-envelope commands are rejected unless
      // the legacy unsigned mode has been explicitly opted into.
      if (!envelope && requireSignedCommands) {
        const commandId = typeof body.commandId === 'string' ? body.commandId : '';
        const reason = 'Rejected: signed command envelope required';
        await emitRejected(commandId, reason);
        return { ok: false, error: reason, errorCode: 'MQTT_POLICY_REJECTED' };
      }

      const command = envelope
        ? {
            commandId: envelope.commandId,
            command: envelope.command,
            payload: body.payload,
            requestedBy: envelope.issuerIdentity,
            createdAt: envelope.issuedAt,
          }
        : parseCommand(message);

      // Bind the unsigned outer payload to the signed envelope: the executor
      // must never receive a payload that differs from the one the issuer hashed
      // and signed (integrity/tamper protection).
      if (envelope) {
        const actualPayloadHash = toHex(
          sha3_256(new TextEncoder().encode(canonicalJson(body.payload))),
        );
        if (actualPayloadHash !== envelope.payloadHash) {
          const reason = 'Rejected: command payload hash mismatch';
          await emitRejected(envelope.commandId, reason);
          return { ok: false, error: reason, errorCode: 'MQTT_POLICY_REJECTED' };
        }
      }

      // Replay protection: commandId and createdAt must be present.
      if (!command.commandId) {
        const reason = 'Rejected: missing commandId';
        await emitRejected(command.commandId, reason);
        return { ok: false, error: reason, errorCode: 'MQTT_POLICY_REJECTED' };
      }
      const validityError = (now: number): string | undefined => {
        if (!Number.isSafeInteger(command.createdAt) || command.createdAt <= 0 ||
            !Number.isSafeInteger(command.createdAt + maxAgeMs)) {
          return 'Rejected: invalid createdAt — replay prevention';
        }
        if (command.createdAt > now) return 'Rejected: command issued in the future';
        if (now - command.createdAt > maxAgeMs) return 'Rejected: command too old';
        if (envelope) {
          if (!Number.isSafeInteger(envelope.expiresAt) ||
              envelope.expiresAt <= envelope.issuedAt ||
              envelope.expiresAt - envelope.issuedAt > maxAgeMs) {
            return 'Rejected: invalid command envelope lifetime';
          }
          if (now >= envelope.expiresAt) return 'Rejected: command envelope expired';
        }
        return undefined;
      };
      const initialValidityError = validityError(Date.now());
      if (initialValidityError) {
        const reason = initialValidityError;
        await emitRejected(command.commandId, reason);
        return { ok: false, error: reason, errorCode: 'MQTT_POLICY_REJECTED' };
      }

      // RFC-020 H5: verify the signed envelope BEFORE marking its replay slot
      // (a failed verification must not poison the slot), and fail closed when
      // an envelope is present but no verifier is configured.
      if (envelope) {
        if (!config.verifyCommandSignature) {
          const reason = 'Rejected: signed envelope present but no verifyCommandSignature configured';
          await emitRejected(envelope.commandId, reason);
          return { ok: false, error: reason, errorCode: 'MQTT_POLICY_REJECTED' };
        }
        const valid = await config.verifyCommandSignature(envelope);
        if (valid !== true) {
          const reason = 'Rejected: invalid command signature';
          await emitRejected(envelope.commandId, reason);
          return { ok: false, error: reason, errorCode: 'MQTT_POLICY_REJECTED' };
        }
      }

      // Verification may be asynchronous; do not claim or execute an expired command.
      const claimTime = Date.now();
      const verifiedValidityError = validityError(claimTime);
      if (verifiedValidityError) {
        await emitRejected(command.commandId, verifiedValidityError);
        return { ok: false, error: verifiedValidityError, errorCode: 'MQTT_POLICY_REJECTED' };
      }
      let claimed: boolean;
      try {
        claimed = await ledger.claim(command.commandId, command.createdAt + maxAgeMs, claimTime);
      } catch {
        const reason = 'Rejected: replay claim unavailable — execution blocked';
        await emitRejected(command.commandId, reason);
        return { ok: false, error: reason, errorCode: 'MQTT_REPLAY_UNAVAILABLE' };
      }
      if (claimed !== true) {
        const reason = 'Rejected: duplicate commandId — replay prevented';
        await emitRejected(command.commandId, reason);
        return { ok: false, error: reason, errorCode: 'MQTT_POLICY_REJECTED' };
      }

      const policyPort = config.runtime.ports.policy;
      if (!policyPort) {
        const reason = 'Rejected: policy port not configured — fail closed';
        await emitRejected(command.commandId, reason);
        return { ok: false, error: reason, errorCode: 'MQTT_POLICY_REJECTED' };
      }

      const decision = await policyPort.check({
        action: command.command,
        subject: command.requestedBy ?? 'unknown',
        context: { commandId: command.commandId, topic: message.topic },
      });

      if (!decision.ok || decision.data?.allowed !== true) {
        const reason = decision.data?.reason ?? decision.error ?? 'Policy denied';
        await emitRejected(command.commandId, reason);
        return { ok: false, error: reason, errorCode: 'MQTT_POLICY_REJECTED' };
      }

      if (!config.executor) {
        const receipt = createMqttReceipt({ kind: 'command', payload: { commandId: command.commandId, status: 'no-executor' } });
        await publishMqttReceipt(config.client, receipt, receiptTopic);
        return { ok: false, error: 'No command executor injected', errorCode: 'NO_EXECUTOR' };
      }

      const executionValidityError = validityError(Date.now());
      if (executionValidityError) {
        await emitRejected(command.commandId, executionValidityError);
        return { ok: false, error: executionValidityError, errorCode: 'MQTT_POLICY_REJECTED' };
      }
      const result = await config.executor.execute({
        commandId: command.commandId,
        command: command.command,
        payload: command.payload,
        requestedBy: command.requestedBy,
        createdAt: command.createdAt,
      });

      const receipt = createMqttReceipt({
        kind: 'command',
        payload: { commandId: command.commandId, status: result.ok ? 'executed' : 'failed', error: result.error },
      });
      await publishMqttReceipt(config.client, receipt, receiptTopic);
      return result;
    },
  };
}
