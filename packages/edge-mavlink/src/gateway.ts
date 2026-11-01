/**
 * MAVLink Edge Gateway — drone telemetry, heartbeat and command correlation.
 *
 * Wire-only: it does not authorize missions, geofences or physical limits.
 * Governed flight actions belong to the `@totemsdk/act-mavlink` profile
 * (RFC-025), built on `@totemsdk/act-core`.
 */

import type { EdgeRuntime, EdgeOperationResult } from '@totemsdk/edge';
import type { MavlinkTransportPort } from './transport.js';
import {
  decodeFrames, decodeMessage, encodeCommandLong, encodeHeartbeat,
  MESSAGE_IDS, type MavlinkMessage,
} from './codec.js';

export interface MavlinkGatewayConfig {
  runtime: EdgeRuntime;
  transport: MavlinkTransportPort;
  systemId: number;
  componentId: number;
  /** Target system/component for commands. Defaults to the gateway IDs. */
  targetSystemId?: number;
  targetComponentId?: number;
  /** Heartbeat interval in ms; 0 disables automatic heartbeats. Default 1000. */
  heartbeatIntervalMs?: number;
  commandTimeoutMs?: number;
}

export type MavlinkMessageHandler = (message: MavlinkMessage) => void;

export interface MavlinkCommandResult {
  result: number;
  ack: MavlinkMessage;
}

export interface MavlinkGateway {
  start(): Promise<void>;
  stop(): Promise<void>;
  readonly status: 'stopped' | 'running' | 'error';
  sendHeartbeat(): Promise<void>;
  command(command: number, params?: number[], timeoutMs?: number): Promise<EdgeOperationResult<MavlinkCommandResult>>;
  /** Subscribe to a message id, or '*' for all decoded messages. */
  onMessage(messageId: number | '*', handler: MavlinkMessageHandler): () => void;
}

interface PendingCommand {
  settle: (result: EdgeOperationResult<MavlinkCommandResult>) => void;
  timer: ReturnType<typeof setTimeout>;
}

export function createMavlinkGateway(config: MavlinkGatewayConfig): MavlinkGateway {
  let status: 'stopped' | 'running' | 'error' = 'stopped';
  let sequence = 0;
  let buffer: Uint8Array = new Uint8Array(0);
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  let unsubData: (() => void) | undefined;
  let unsubError: (() => void) | undefined;
  const pending = new Map<number, PendingCommand>();
  const handlers = new Map<number | '*', Set<MavlinkMessageHandler>>();
  const commandTimeoutMs = config.commandTimeoutMs ?? 5000;

  function dispatch(message: MavlinkMessage): void {
    const keys: Array<number | '*'> = [message.messageId, '*'];
    for (const key of keys) {
      for (const handler of handlers.get(key) ?? []) {
        try { handler(message); } catch { /* consumer failure must not break the link */ }
      }
    }
    if (message.messageId === MESSAGE_IDS.COMMAND_ACK) {
      const command = Number(message.decoded.command);
      const entry = pending.get(command);
      if (!entry) return;
      pending.delete(command);
      clearTimeout(entry.timer);
      entry.settle({ ok: true, data: { result: Number(message.decoded.result), ack: message } });
    }
  }

  function failPending(error: string): void {
    for (const [, entry] of pending) {
      clearTimeout(entry.timer);
      entry.settle({ ok: false, error });
    }
    pending.clear();
  }

  function onData(chunk: Uint8Array): void {
    const combined = new Uint8Array(buffer.length + chunk.length);
    combined.set(buffer, 0);
    combined.set(chunk, buffer.length);
    const { frames, rest } = decodeFrames(combined);
    buffer = rest;
    for (const frame of frames) dispatch(decodeMessage(frame));
  }

  return {
    get status() { return status; },

    async start(): Promise<void> {
      if (status === 'running') return;
      await config.transport.start();
      unsubData = config.transport.onData(onData);
      unsubError = config.transport.onError(() => { status = 'error'; });
      status = 'running';
      const interval = config.heartbeatIntervalMs ?? 1000;
      if (interval > 0) {
        heartbeatTimer = setInterval(() => { void this.sendHeartbeat().catch(() => { status = 'error'; }); }, interval);
      }
    },

    async stop(): Promise<void> {
      if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = undefined; }
      unsubData?.(); unsubError?.();
      unsubData = undefined; unsubError = undefined;
      failPending('gateway stopped');
      await config.transport.stop();
      status = 'stopped';
    },

    async sendHeartbeat(): Promise<void> {
      await config.transport.send(encodeHeartbeat(config.systemId, config.componentId, sequence++ & 0xff));
    },

    async command(command, params = [], timeoutMs = commandTimeoutMs) {
      const targetSystem = config.targetSystemId ?? config.systemId;
      const targetComponent = config.targetComponentId ?? config.componentId;
      const frame = encodeCommandLong(sequence++ & 0xff, config.systemId, config.componentId, targetSystem, targetComponent, command, params);
      if (pending.has(command)) return { ok: false, error: `COMMAND ${command} is already pending` };
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          pending.delete(command);
          resolve({ ok: false, error: `COMMAND_ACK ${command} timed out` });
        }, timeoutMs);
        pending.set(command, { settle: resolve, timer });
        void config.transport.send(frame).catch((error) => {
          const entry = pending.get(command);
          if (!entry) return;
          pending.delete(command);
          clearTimeout(entry.timer);
          entry.settle({ ok: false, error: error instanceof Error ? error.message : String(error) });
        });
      });
    },

    onMessage(messageId, handler) {
      const set = handlers.get(messageId) ?? new Set<MavlinkMessageHandler>();
      set.add(handler);
      handlers.set(messageId, set);
      return () => {
        set.delete(handler);
        if (set.size === 0) handlers.delete(messageId);
      };
    },
  };
}
