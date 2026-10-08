// packages/totem-extension/src/telemetry.ts
//
// Opt-in, privacy-safe usage telemetry. Disabled by default and only active
// after the user enables "Anonymous Usage Data" in Settings (Chrome Web Store
// policy). The payload is a strict allowlist of non-identifying operational
// fields — never wallet addresses, keys, page URLs, or origins.
//
// Delivery path: the extension authenticates to the Axia telemetry proxy with a
// short-lived JWT (from api.axia.to/v1/tlm/token); the proxy verifies the JWT
// and re-signs the batch with HMAC for the ingestor. So a batch is only accepted
// with a valid bearer token.
import { getTelemetryToken } from './telemetry_token';

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
// Bound the queue so a dead or misconfigured endpoint can never grow memory
// without limit. When full, the oldest events are dropped (telemetry is
// best-effort; losing samples is preferable to a leak).
const MAX_QUEUE = 500;
// Consecutive delivery failures before the client backs off. Prevents a
// tight retry loop against an unreachable host.
const MAX_CONSECUTIVE_FAILURES = 3;
let consecutiveFailures = 0;
let backoffUntil = 0;

// Telemetry is opt-in only (Chrome Web Store policy). No data is collected
// until the user explicitly enables it in Settings.
export const TELEMETRY_CONSENT_KEY = 'totem_telemetry_consent';
let telemetryEnabled = false;

export async function initTelemetry(): Promise<void> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const result = await chrome.storage.local.getTyped(TELEMETRY_CONSENT_KEY);
      telemetryEnabled = result[TELEMETRY_CONSENT_KEY] === true;

      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes[TELEMETRY_CONSENT_KEY]) {
          telemetryEnabled = changes[TELEMETRY_CONSENT_KEY].newValue === true;
        }
      });
    }
  } catch {
    telemetryEnabled = false;
  }
}

export function isTelemetryEnabled(): boolean {
  return telemetryEnabled;
}

export async function setTelemetryEnabled(enabled: boolean): Promise<void> {
  telemetryEnabled = enabled;
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({ [TELEMETRY_CONSENT_KEY]: enabled });
    }
  } catch {
    // keep in-memory flag; persistence failure is non-fatal
  }
}

export function track(e: TlmEvent) {
  if (!telemetryEnabled) return;
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
  // Drop oldest if the queue is full (best-effort delivery).
  while (QUEUE.length > MAX_QUEUE) QUEUE.shift();
  schedule();
}

function schedule() {
  if (timer) return;
  const delay = Math.max(0, backoffUntil - Date.now());
  timer = setTimeout(flush, delay > 0 ? delay : FLUSH_MS);
}

/** Resolve the project id used for telemetry auth (defaults to the wallet). */
async function getProjectId(): Promise<string> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const s = await chrome.storage.local.getTyped(['AXIA_PROJECT_ID']);
      if (s.AXIA_PROJECT_ID) return String(s.AXIA_PROJECT_ID);
    }
  } catch {
    // fall through to default
  }
  return 'totem-extension';
}

async function flush() {
  timer = null;
  if (!QUEUE.length) return;
  if (Date.now() < backoffUntil) { schedule(); return; }

  const batch = QUEUE.splice(0, MAX_BATCH);
  try {
    // Authenticate with a short-lived JWT; the proxy turns it into the HMAC
    // header the ingestor requires. (Static import: the background service
    // worker disables chunk loading, so dynamic import() is unavailable.)
    const projectId = await getProjectId();
    const jwt = await getTelemetryToken(projectId);

    const res = await fetch(TLM_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`
      },
      body: JSON.stringify({ events: batch })
    });

    if (!res.ok) throw new Error(`telemetry ${res.status}`);
    consecutiveFailures = 0;
  } catch {
    // Best-effort: do NOT requeue unboundedly. Drop this batch and back off
    // after repeated failures so an unreachable endpoint can't cause a retry
    // storm or leak memory.
    consecutiveFailures += 1;
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      backoffUntil = Date.now() + 60_000;
      consecutiveFailures = 0;
    }
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
