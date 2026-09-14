/**
 * @totemsdk/qvac/system — System domain adapter (heartbeat / resources / logs / lifecycle).
 */

import type { IntelligenceProvider } from '@totemsdk/intelligence';
import { bindDomain } from './adapter.js';
import type { QvacOp } from './adapter.js';

export const systemDomain = 'system' as const;

export interface QvacSystemOps {
  heartbeat: QvacOp<Record<string, never>, { status?: string }>;
  getSystemResources: QvacOp<Record<string, never>, { cpu?: string; gpu?: string }>;
  loggingStream: QvacOp<Record<string, never>, unknown>;
  subscribeServerLogs: QvacOp<Record<string, never>, unknown>;
  cancel: QvacOp<{ requestId?: string }, unknown>;
  close: QvacOp<Record<string, never>, unknown>;
}

export function systemAdapter(provider: IntelligenceProvider): QvacSystemOps {
  return {
    heartbeat: bindDomain(provider, systemDomain, 'heartbeat'),
    getSystemResources: bindDomain(provider, systemDomain, 'getSystemResources'),
    loggingStream: bindDomain(provider, systemDomain, 'loggingStream'),
    subscribeServerLogs: bindDomain(provider, systemDomain, 'subscribeServerLogs'),
    cancel: bindDomain(provider, systemDomain, 'cancel'),
    close: bindDomain(provider, systemDomain, 'close'),
  };
}