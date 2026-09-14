/**
 * @totemsdk/qvac/system — System domain adapter (heartbeat / resources / logs / lifecycle).
 *
 * `subscribeServerLogs` is a CALLBACK op upstream — it takes a handler and
 * returns an unsubscribe function — so it is surfaced as an explicit wrapper;
 * the provider normalises that teardown into `{ unsubscribe: () => void }`.
 * `loggingStream` is stream-capable via `invokeStream`.
 */

import type { IntelligenceOutcome, IntelligenceProvider } from '@totemsdk/intelligence';
import { bindCallback, bindDomain } from './adapter.js';
import type { QvacOp } from './adapter.js';

import type {
  CancelClientInput,
  GetSystemResourcesInput,
  HeartbeatResponse,
  LoggingParams,
  LoggingStreamResponse,
  ServerLogHandler,
  SystemResources,
} from '@qvac/sdk';

export const systemDomain = 'system' as const;

export type {
  CancelClientInput,
  GetSystemResourcesInput,
  HeartbeatResponse,
  LogLevel,
  LoggingParams,
  LoggingStreamResponse,
  ServerLogHandler,
  SystemResources,
} from '@qvac/sdk';

export interface QvacSystemOps {
  heartbeat: QvacOp<Record<string, never>, HeartbeatResponse>;
  getSystemResources: QvacOp<GetSystemResourcesInput, SystemResources>;
  loggingStream: QvacOp<LoggingParams, AsyncGenerator<LoggingStreamResponse>>;
  /**
   * Real upstream signature: `subscribeServerLogs(handler)` returns an
   * unsubscribe function; the adapter surfaces it as `{ unsubscribe }`.
   */
  subscribeServerLogs: (
    handler: ServerLogHandler,
  ) => Promise<IntelligenceOutcome<{ unsubscribe: () => void }>>;
  cancel: QvacOp<CancelClientInput, void>;
  close: QvacOp<Record<string, never>, void>;
}

export function systemAdapter(provider: IntelligenceProvider): QvacSystemOps {
  return {
    heartbeat: bindDomain(provider, systemDomain, 'heartbeat'),
    getSystemResources: bindDomain(provider, systemDomain, 'getSystemResources'),
    loggingStream: bindDomain(provider, systemDomain, 'loggingStream'),
    subscribeServerLogs: bindCallback<ServerLogHandler, { unsubscribe: () => void }>(
      provider, systemDomain, 'subscribeServerLogs', 'handler',
    ),
    cancel: bindDomain(provider, systemDomain, 'cancel'),
    close: bindDomain(provider, systemDomain, 'close'),
  };
}