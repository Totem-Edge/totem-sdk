// packages/totem-extension/src/telemetry.ts
type TlmEvent = {
  project_id: string;
  method: string;
  client_version: string;
  platform: string;
  region?: string;
  ts?: number;
  latency_ms?: number;
  outcome?: 'ok'|'error';
  error_class?: 'client'|'server'|'upstream'|'rate_limit'|'validation'|'other';
  retry?: { reason: '429'|'5xx'|'network'|'timeout'; count: number };
  credits?: { unit: 'request'|'byte'|'txn'; amount: number; plan_tier?: string };
};

const QUEUE: TlmEvent[] = [];
let timer: any = null;

const TLM_URL = 'https://telemetry.axia.to/v1/telemetry';
const FLUSH_MS = 4000;
const MAX_BATCH = 50;

export function track(e: TlmEvent) {
  // never add PII, keep only allowlisted fields
  QUEUE.push({
    project_id: e.project_id,
    method: e.method,
    client_version: e.client_version,
    platform: e.platform,
    region: e.region,
    ts: e.ts || Date.now(),
    latency_ms: e.latency_ms,
    outcome: e.outcome,
    error_class: e.error_class,
    retry: e.retry,
    credits: e.credits
  });
  schedule();
}

function schedule() {
  if (timer) return;
  timer = setTimeout(flush, FLUSH_MS);
}

async function flush() {
  timer = null;
  if (!QUEUE.length) return;
  const batch = QUEUE.splice(0, MAX_BATCH);
  try {
    await fetch(TLM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch })
    });
  } catch (e) {
    // Requeue on failure (basic)
    QUEUE.unshift(...batch);
  } finally {
    if (QUEUE.length) schedule();
  }
}

// Helper around RPC call (wraps fetch) to capture latency/outcomes
export async function withTelemetry<T>(projectId: string, method: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now ? performance.now() : Date.now();
  try {
    const res = await fn();
    const latency = (performance.now ? performance.now() : Date.now()) - start;
    track({
      project_id: projectId,
      method,
      client_version: process.env.TOTEM_VERSION || '1.0.0',
      platform: 'chrome',
      latency_ms: latency,
      outcome: 'ok'
    });
    return res;
  } catch (err: any) {
    const latency = (performance.now ? performance.now() : Date.now()) - start;
    const klass = classifyError(err);
    track({
      project_id: projectId,
      method,
      client_version: process.env.TOTEM_VERSION || '1.0.0',
      platform: 'chrome',
      latency_ms: latency,
      outcome: 'error',
      error_class: klass
    });
    throw err;
  }
}

function classifyError(err: any): TlmEvent['error_class'] {
  const msg = String(err?.message || '').toLowerCase();
  if (msg.includes('429')) return 'rate_limit';
  if (msg.includes('timeout')) return 'server';
  if (msg.includes('network')) return 'server';
  if (msg.includes('nonce') || msg.includes('insufficient') || msg.includes('invalid')) return 'validation';
  if (msg.includes('5')) return 'server';
  return 'other';
}