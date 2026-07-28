/**
 * observability.ts — lightweight privacy-preserving telemetry for the PWA wallet.
 *
 * Mirrors the @totem/observability dApp starter interface:
 *   init({ dappId, endpoint, hmacSecret?, clientVersion })
 *   track(event, payload?)
 *
 * Privacy rules:
 *   - No raw public keys or seed material is ever sent.
 *   - Wallet identity is represented only by the SHA3-256 identity hash.
 *   - Events are batched and sent async so they never block the UI.
 */

interface ObsConfig {
  dappId: string;
  endpoint: string;
  hmacSecret?: string;
  clientVersion: string;
}

interface ObsEvent {
  event: string;
  dappId: string;
  clientVersion: string;
  sessionId: string;
  ts: number;
  payload?: Record<string, unknown>;
}

let _cfg: ObsConfig | null = null;
let _sessionId = '';
const _queue: ObsEvent[] = [];
let _flushTimer: ReturnType<typeof setTimeout> | null = null;

/** One-time initialisation — call from main.tsx / App.tsx on mount. */
export function init(config: ObsConfig): void {
  _cfg = config;
  _sessionId = [Date.now().toString(36), Math.random().toString(36).slice(2)].join('_');
}

/** Record a telemetry event.  Payload values must be plain scalars — no keys. */
export function track(event: string, payload?: Record<string, unknown>): void {
  if (!_cfg) return;
  _queue.push({
    event,
    dappId: _cfg.dappId,
    clientVersion: _cfg.clientVersion,
    sessionId: _sessionId,
    ts: Date.now(),
    payload,
  });
  schedulFlush();
}

function schedulFlush(): void {
  if (_flushTimer) return;
  _flushTimer = setTimeout(flush, 2_000);
}

function flush(): void {
  _flushTimer = null;
  if (!_cfg || _queue.length === 0) return;
  const batch = _queue.splice(0, _queue.length);
  const endpoint = _cfg.endpoint;
  // Fire-and-forget
  fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ events: batch }),
    keepalive: true,
  }).catch(() => { /* non-fatal */ });
}
