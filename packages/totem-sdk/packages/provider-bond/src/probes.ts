import type { ProbeResult, RecordProbeParams } from './types.js';

let probeCounter = 0;

export function recordProbe(params: RecordProbeParams): ProbeResult {
  const now = params.now ?? Date.now();
  probeCounter++;
  return {
    probeId: `probe-${now}-${probeCounter}`,
    providerId: params.providerId,
    type: params.type,
    ok: params.ok,
    latencyMs: params.latencyMs,
    observedAt: now,
    message: params.message,
    metadata: params.metadata,
  };
}

export function recordHeartbeat(providerId: string, now?: number): ProbeResult {
  return recordProbe({
    providerId,
    type: 'heartbeat',
    ok: true,
    now,
  });
}
