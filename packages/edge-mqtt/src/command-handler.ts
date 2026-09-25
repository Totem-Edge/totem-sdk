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
 * Replay protection: processed command IDs are tracked for the maximum
 * command validity period (config.maxCommandAgeMs, default 60s). When a
 * durable replay store is configured (config.replayStore), the ledger is
 * persisted so a command accepted before a restart is still rejected
 * afterward (RFC-007 G4). Without a store it falls back to the in-memory
 * freshness window.
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

interface LedgerEntry {
  seenAt: number;
}

class ReplayLedger {
  private readonly seen = new Map<string, number>();
  private lastMemoryPrune = 0;

  constructor(
    private readonly maxAgeMs: number,
    private readonly store?: ReplayLedgerStore,
  ) {}

  private key(id: string): string {
    return `${REPLAY_LEDGER_PREFIX}${id}`;
  }

  private pruneMemory(now: number): void {
    if (now - this.lastMemoryPrune <= this.maxAgeMs) return;
    for (const [id, seenAt] of this.seen) {
      if (now - seenAt > this.maxAgeMs) this.seen.delete(id);
    }
    this.lastMemoryPrune = now;
  }

  private async load(id: string): Promise<number | undefined> {
    if (!this.store) {
      return this.seen.get(id);
    }
    const entry = await this.store.get<LedgerEntry>(this.key(id));
    return entry?.seenAt;
  }

  private async persist(id: string, seenAt: number): Promise<void> {
    if (!this.store) {
      this.seen.set(id, seenAt);
      return;
    }
    await this.store.set(this.key(id), { seenAt } satisfies LedgerEntry);
  }

  /** Returns true if the command id was already processed (replay). */
  async mark(commandId: string): Promise<boolean> {
    const now = Date.now();
    this.pruneMemory(now);
    const seenAt = await this.load(commandId);
    if (seenAt !== undefined && now - seenAt <= this.maxAgeMs) {
      return true;
    }
    if (seenAt !== undefined && this.store) {
      // Expired entry: drop it so the ledger stays bounded, then re-record.
      await this.store.remove(this.key(commandId));
    }
    await this.persist(commandId, now);
    return false;
  }
}

export function createMqttCommandHandler(config: MqttCommandHandlerConfig): MqttCommandHandler {
  const maxAgeMs = config.maxCommandAgeMs ?? REPLAY_VALIDITY_MS;
  const ledger = new ReplayLedger(maxAgeMs, config.replayStore);

  return {
    async handleCommand(message: MqttMessage): Promise<EdgeOperationResult> {
      const receiptTopic = config.receiptTopic ?? `totem/${config.runtime.deviceId}/receipts`;

      const emitRejected = async (commandId: string, reason: string): Promise<void> => {
        const receipt = createMqttReceipt({ kind: 'command', payload: { commandId, status: 'rejected', reason } });
        await publishMqttReceipt(config.client, receipt, receiptTopic);
      };

      // Parse envelope (signed) or legacy unsigned command body.
      let body: Record<string, unknown> = {};
      const raw = message.payload instanceof Uint8Array
        ? new TextDecoder().decode(message.payload)
        : message.payload;
      try { body = JSON.parse(raw) as Record<string, unknown>; } catch { body = {}; }

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

      // Signed envelope validity windows.
      if (envelope) {
        if (Date.now() > envelope.expiresAt) {
          const reason = 'Rejected: command envelope expired';
          await emitRejected(envelope.commandId, reason);
          return { ok: false, error: reason, errorCode: 'MQTT_POLICY_REJECTED' };
        }
        if (Date.now() - envelope.issuedAt > maxAgeMs) {
          const reason = 'Rejected: command too old';
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
      if (!command.createdAt) {
        const reason = 'Rejected: missing createdAt — replay prevention';
        await emitRejected(command.commandId, reason);
        return { ok: false, error: reason, errorCode: 'MQTT_POLICY_REJECTED' };
      }
      if (await ledger.mark(command.commandId)) {
        const reason = 'Rejected: duplicate commandId — replay prevented';
        await emitRejected(command.commandId, reason);
        return { ok: false, error: reason, errorCode: 'MQTT_POLICY_REJECTED' };
      }

      // Cryptographic verification only exists for signed envelopes.
      if (envelope && config.verifyCommandSignature) {
        const valid = await config.verifyCommandSignature(envelope);
        if (!valid) {
          const reason = 'Rejected: invalid command signature';
          await emitRejected(envelope.commandId, reason);
          return { ok: false, error: reason, errorCode: 'MQTT_POLICY_REJECTED' };
        }
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

      if (!decision.ok || (decision.data && !decision.data.allowed)) {
        const reason = decision.data?.reason ?? decision.error ?? 'Policy denied';
        await emitRejected(command.commandId, reason);
        return { ok: false, error: reason, errorCode: 'MQTT_POLICY_REJECTED' };
      }

      if (!config.executor) {
        const receipt = createMqttReceipt({ kind: 'command', payload: { commandId: command.commandId, status: 'no-executor' } });
        await publishMqttReceipt(config.client, receipt, receiptTopic);
        return { ok: false, error: 'No command executor injected', errorCode: 'NO_EXECUTOR' };
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