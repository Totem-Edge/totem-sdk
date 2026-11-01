/**
 * OCPP Edge Gateway — charge-point side of OCPP-J.
 *
 * The gateway owns framing, CALL/CALLRESULT/CALLERROR correlation, inbound CALL
 * dispatch, boot notification and heartbeat. It has no decision, authority or
 * physical-effect policy: starting/stopping a charging session must go through
 * the governed `@totemsdk/act-ocpp` profile (RFC-024).
 */

import type { EdgeRuntime, EdgeOperationResult } from '@totemsdk/edge';
import type { OcppTransportPort } from './transport.js';
import {
  encodeCall, encodeCallError, encodeCallResult, OcppError, parseOcppFrame,
  type OcppErrorCode,
} from './ocpp.js';

export type OcppVersion = '1.6J' | '2.0.1';

export interface OcppGatewayConfig {
  runtime: EdgeRuntime;
  transport: OcppTransportPort;
  url: string;
  chargePointId: string;
  version?: OcppVersion;
  protocols?: string[];
  /** Heartbeat interval; 0 disables automatic heartbeats. Default 30s. */
  heartbeatIntervalMs?: number;
  callTimeoutMs?: number;
  /** Send BootNotification during start. Default true. */
  bootOnStart?: boolean;
  bootNotification?: Record<string, unknown>;
}

export type OcppCallHandler = (payload: Record<string, unknown>) => Promise<Record<string, unknown>> | Record<string, unknown>;

export interface OcppGateway {
  start(): Promise<void>;
  stop(): Promise<void>;
  readonly status: 'stopped' | 'running' | 'error';
  call(action: string, payload?: Record<string, unknown>, timeoutMs?: number): Promise<EdgeOperationResult<{ payload: Record<string, unknown> }>>;
  /** Register a handler for an inbound CSMS CALL. */
  onCall(action: string, handler: OcppCallHandler): () => void;
  sendBootNotification(payload?: Record<string, unknown>): Promise<EdgeOperationResult<{ payload: Record<string, unknown> }>>;
  sendHeartbeat(): Promise<EdgeOperationResult<{ payload: Record<string, unknown> }>>;
  sendStatusNotification(connectorId: number, status: string, errorCode?: string): Promise<EdgeOperationResult<{ payload: Record<string, unknown> }>>;
  authorize(idTag: string): Promise<EdgeOperationResult<{ payload: Record<string, unknown> }>>;
}

interface PendingCall {
  resolve: (payload: Record<string, unknown>) => void;
  reject: (error: OcppError) => void;
  timer: ReturnType<typeof setTimeout>;
}

export function createOcppGateway(config: OcppGatewayConfig): OcppGateway {
  let status: 'stopped' | 'running' | 'error' = 'stopped';
  let sequence = 0;
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  let unsubMessage: (() => void) | undefined;
  let unsubClose: (() => void) | undefined;
  let unsubError: (() => void) | undefined;
  const pending = new Map<string, PendingCall>();
  const callHandlers = new Map<string, Set<OcppCallHandler>>();
  const callTimeoutMs = config.callTimeoutMs ?? 10_000;
  const bootPayload = config.bootNotification ?? { chargePointVendor: 'Totem', chargePointModel: 'Edge' };

  function rejectAll(error: OcppError): void {
    for (const [, entry] of pending) {
      clearTimeout(entry.timer);
      entry.reject(error);
    }
    pending.clear();
  }

  function result<T>(payload: T): EdgeOperationResult<T> {
    return { ok: true, data: payload };
  }

  function failure(error: unknown): EdgeOperationResult<{ payload: Record<string, unknown> }> {
    if (error instanceof OcppError) return { ok: false, error: error.message, errorCode: error.code };
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }

  function sendCall(action: string, payload: Record<string, unknown> = {}, timeoutMs = callTimeoutMs): Promise<EdgeOperationResult<{ payload: Record<string, unknown> }>> {
    return call(action, payload, timeoutMs);
  }

  async function call(action: string, payload: Record<string, unknown> = {}, timeoutMs = callTimeoutMs): Promise<EdgeOperationResult<{ payload: Record<string, unknown> }>> {
    const messageId = `${config.chargePointId}-${++sequence}`;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        pending.delete(messageId);
        resolve({ ok: false, error: `OCPP ${action} timed out` });
      }, timeoutMs);
      pending.set(messageId, {
        resolve: (response) => resolve(result({ payload: response })),
        reject: (error) => resolve({ ok: false, error: error.message, errorCode: error.code }),
        timer,
      });
      void config.transport.send(encodeCall(messageId, action, payload)).catch((error) => {
        const entry = pending.get(messageId);
        if (!entry) return;
        pending.delete(messageId);
        clearTimeout(entry.timer);
        resolve(failure(error));
      });
    });
  }

  async function handleRaw(raw: string): Promise<void> {
    let frame;
    try {
      frame = parseOcppFrame(raw);
    } catch {
      status = 'error';
      return;
    }

    if (frame.type === 3) {
      const entry = pending.get(frame.messageId);
      if (!entry) return;
      pending.delete(frame.messageId);
      clearTimeout(entry.timer);
      status = 'running';
      entry.resolve(frame.payload);
      return;
    }

    if (frame.type === 4) {
      const entry = pending.get(frame.messageId);
      if (!entry) return;
      pending.delete(frame.messageId);
      clearTimeout(entry.timer);
      entry.reject(new OcppError(frame.errorCode, frame.errorDescription, frame.errorDetails));
      return;
    }

    const handlers = callHandlers.get(frame.action);
    let response: Record<string, unknown> = {};
    try {
      if (!handlers || handlers.size === 0) {
        await config.transport.send(encodeCallError(frame.messageId, 'NotSupported', `No handler for ${frame.action}`));
        return;
      }
      for (const handler of handlers) response = await handler(frame.payload);
      await config.transport.send(encodeCallResult(frame.messageId, response));
    } catch (error) {
      const code: OcppErrorCode = error instanceof OcppError ? error.code : 'InternalError';
      const description = error instanceof Error ? error.message : String(error);
      const details = error instanceof OcppError ? error.details : {};
      await config.transport.send(encodeCallError(frame.messageId, code, description, details)).catch(() => {});
    }
  }

  return {
    get status() { return status; },

    async start(): Promise<void> {
      if (status === 'running') return;
      try {
        await config.transport.connect(config.url, config.protocols);
        unsubMessage = config.transport.onMessage((raw) => { void handleRaw(raw); });
        unsubClose = config.transport.onClose(() => {
          status = 'error';
          rejectAll(new OcppError('GenericError', 'OCPP connection closed'));
        });
        unsubError = config.transport.onError(() => { status = 'error'; });

        if (config.bootOnStart ?? true) {
          const boot = await call('BootNotification', bootPayload);
          const bootStatus = boot.ok ? boot.data?.payload.status : undefined;
          if (!boot.ok || bootStatus !== 'Accepted') {
            await this.stop();
            status = 'error';
            throw new Error(`OCPP boot rejected: ${boot.ok ? String(bootStatus) : boot.error}`);
          }
        }
        status = 'running';

        const heartbeatInterval = config.heartbeatIntervalMs ?? 30_000;
        if (heartbeatInterval > 0) {
          heartbeatTimer = setInterval(() => {
            void call('Heartbeat', {}).then((response) => {
              if (!response.ok) status = 'error';
            });
          }, heartbeatInterval);
        }
      } catch (error) {
        status = 'error';
        throw error;
      }
    },

    async stop(): Promise<void> {
      if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = undefined; }
      unsubMessage?.(); unsubClose?.(); unsubError?.();
      unsubMessage = undefined; unsubClose = undefined; unsubError = undefined;
      rejectAll(new OcppError('GenericError', 'OCPP gateway stopped'));
      try { await config.transport.close(); } catch { /* already closed */ }
      status = 'stopped';
    },

    call,

    onCall(action, handler) {
      const handlers = callHandlers.get(action) ?? new Set<OcppCallHandler>();
      handlers.add(handler);
      callHandlers.set(action, handlers);
      return () => {
        handlers.delete(handler);
        if (handlers.size === 0) callHandlers.delete(action);
      };
    },

    sendBootNotification(payload = bootPayload) { return sendCall('BootNotification', payload); },
    sendHeartbeat() { return sendCall('Heartbeat', {}); },
    sendStatusNotification(connectorId, connectorStatus, errorCode = 'NoError') {
      return sendCall('StatusNotification', { connectorId, status: connectorStatus, errorCode });
    },
    authorize(idTag) { return sendCall('Authorize', { idTag }); },
  };
}
