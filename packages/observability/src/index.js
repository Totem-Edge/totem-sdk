const DEFAULT_ENDPOINT = 'https://telemetry.axia.to/v1/telemetry';
const DEFAULT_AXIA_HOSTS = [/\.axia\.to$/i, /^axia\.to$/i];
const FLUSH_MS = 4000;
const MAX_BATCH = 50;

const FORBIDDEN_FIELDS = new Set([
  'address', 'addresses', 'publicKey', 'public_key', 'signature',
  'signatures', 'message', 'mnemonic', 'seed', 'cookie', 'token'
]);

const state = {
  initialized: false,
  dappId: null,
  endpoint: DEFAULT_ENDPOINT,
  hmacSecret: null,
  sampleRate: { ok: 0.25, error: 1.0 },
  axiaHosts: DEFAULT_AXIA_HOSTS,
  queue: [],
  timer: null,
  optOut: false,
  origin: typeof window !== 'undefined' ? location.origin : 'node',
  clientVersion: '0.1.0',
  platform: detectPlatform(),
  origFetch: null,
  origXhrOpen: null,
  origXhrSend: null,
  origXhrSetHeader: null,
  origProviderRequest: null,
  fetchPatched: false,
  xhrPatched: false,
  providerPatched: false,
};

function detectPlatform() {
  if (typeof process !== 'undefined' && process.versions && process.versions.node) return 'node';
  if (typeof navigator === 'undefined') return 'other';
  const ua = (navigator.userAgent || '').toLowerCase();
  if (ua.includes('firefox')) return 'firefox';
  if (ua.includes('edg')) return 'edge';
  if (ua.includes('chrome')) return 'chrome';
  if (ua.includes('safari')) return 'safari';
  return 'other';
}

function isOptedOut(opt) {
  if (opt) return true;
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('axia_obs_opt_out') === '1') return true;
  } catch (_) {}
  return false;
}

function scrub(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = Array.isArray(obj) ? [] : {};
  for (const k of Object.keys(obj)) {
    if (FORBIDDEN_FIELDS.has(k)) continue;
    const v = obj[k];
    out[k] = (v && typeof v === 'object') ? scrub(v) : v;
  }
  return out;
}

function genTraceId() {
  const rand = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return rand(32);
}
function genSpanId() {
  return Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}
function makeTraceparent() {
  return `00-${genTraceId()}-${genSpanId()}-01`;
}

function isAxiaUrl(url) {
  try {
    const u = new URL(url, state.origin);
    return state.axiaHosts.some(rx => rx.test(u.host));
  } catch (_) {
    return false;
  }
}

function shouldSample(outcome) {
  const r = outcome === 'error' ? state.sampleRate.error : state.sampleRate.ok;
  return Math.random() < r;
}

function track(event) {
  if (!state.initialized || state.optOut) return;
  if (!event || !event.kind) return;
  const outcome = event.outcome || 'ok';
  if (!shouldSample(outcome) && !event.force) return;
  const safe = scrub(event);
  state.queue.push({
    project_id: state.dappId,
    method: safe.kind,
    client_version: state.clientVersion,
    platform: state.platform,
    region: safe.region,
    ts: Date.now(),
    latency_ms: safe.latency_ms,
    outcome,
    error_class: safe.error_class,
    source: 'external_dapp',
    dapp_id: state.dappId,
    trace_id: safe.trace_id,
  });
  if (state.queue.length >= MAX_BATCH) flush();
  else schedule();
}

function schedule() {
  if (state.timer) return;
  state.timer = setTimeout(flush, FLUSH_MS);
}

async function flush() {
  state.timer = null;
  if (!state.queue.length || state.optOut) return;
  const batch = state.queue.splice(0, MAX_BATCH);
  const body = JSON.stringify({ source: 'external_dapp', dapp_id: state.dappId, events: batch });
  const headers = { 'Content-Type': 'application/json' };
  headers['X-Axia-Dapp-Id'] = state.dappId;
  if (state.hmacSecret) {
    const ts = String(Math.floor(Date.now() / 1000));
    headers['X-Axia-Project-Id'] = state.dappId;
    headers['X-Axia-Timestamp'] = ts;
    headers['X-Axia-Signature'] = `sha256=${await hmacSha256(state.hmacSecret, ts + '.' + body)}`;
  }
  try {
    const f = state.origFetch || (typeof fetch !== 'undefined' ? fetch : null);
    if (!f) return;
    await f(state.endpoint, { method: 'POST', headers, body, keepalive: true });
  } catch (_) {
    state.queue.unshift(...batch);
    schedule();
  }
}

async function hmacSha256(secret, data) {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
    return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return '';
}

function instrumentFetch() {
  if (state.fetchPatched) return;
  if (typeof globalThis.fetch !== 'function') return;
  const original = globalThis.fetch.bind(globalThis);
  state.origFetch = original;
  state.fetchPatched = true;
  globalThis.fetch = async function patched(input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const startTs = Date.now();
    let traceId = null;
    let nextInit = init;
    if (isAxiaUrl(url)) {
      const tp = makeTraceparent();
      traceId = tp.split('-')[1];
      nextInit = { ...(init || {}) };
      const headers = new Headers((init && init.headers) || (typeof input !== 'string' && input.headers) || {});
      headers.set('traceparent', tp);
      nextInit.headers = headers;
    }
    try {
      const res = await original(input, nextInit);
      if (isAxiaUrl(url)) {
        track({
          kind: 'fetch',
          latency_ms: Date.now() - startTs,
          outcome: res.ok ? 'ok' : 'error',
          error_class: res.ok ? undefined : classifyStatus(res.status),
          trace_id: traceId,
        });
      }
      return res;
    } catch (err) {
      if (isAxiaUrl(url)) {
        track({
          kind: 'fetch',
          latency_ms: Date.now() - startTs,
          outcome: 'error',
          error_class: 'network',
          trace_id: traceId,
        });
      }
      throw err;
    }
  };
}

function classifyStatus(s) {
  if (s === 429) return 'rate_limit';
  if (s >= 500) return 'server';
  if (s === 401 || s === 403) return 'auth';
  if (s >= 400) return 'validation';
  return 'other';
}

function instrumentTotemProvider() {
  if (state.providerPatched) return;
  if (typeof window === 'undefined' || !window.totem || !window.totem.request) return;
  const orig = window.totem.request.bind(window.totem);
  state.origProviderRequest = window.totem.request;
  state.providerPatched = true;
  window.totem.request = async function tracked(arg) {
    const method = (arg && arg.method) || 'unknown';
    const kindMap = {
      TOTEM_CONNECT: 'connect',
      TOTEM_VERIFY: 'verify',
      wots_sign: 'send_tx',
      TOTEM_GET_ACCOUNTS: 'get_accounts',
    };
    const kind = kindMap[method] || `provider_${method}`;
    const start = Date.now();
    try {
      const result = await orig(arg);
      track({ kind, latency_ms: Date.now() - start, outcome: 'ok' });
      return result;
    } catch (err) {
      track({
        kind,
        latency_ms: Date.now() - start,
        outcome: 'error',
        error_class: classifyError(err),
      });
      throw err;
    }
  };
}

function classifyError(err) {
  const msg = String((err && err.message) || err || '').toLowerCase();
  if (msg.includes('user reject')) return 'user_reject';
  if (msg.includes('timeout')) return 'timeout';
  if (msg.includes('network')) return 'network';
  if (msg.includes('rate limit')) return 'rate_limit';
  return 'other';
}

function init(opts) {
  if (state.initialized) return;
  if (!opts || !opts.dappId) {
    console.warn('[@totem/observability] init() requires { dappId }');
    return;
  }
  state.optOut = isOptedOut(opts.optOut);
  if (state.optOut) {
    state.initialized = true;
    return;
  }
  state.dappId = opts.dappId;
  state.endpoint = opts.endpoint || DEFAULT_ENDPOINT;
  state.hmacSecret = opts.hmacSecret || null;
  if (opts.sampleRate) state.sampleRate = { ...state.sampleRate, ...opts.sampleRate };
  if (opts.axiaHosts) state.axiaHosts = opts.axiaHosts;
  if (opts.clientVersion) state.clientVersion = opts.clientVersion;
  state.initialized = true;

  instrumentFetch();
  instrumentXhr();
  instrumentTotemProvider();
  if (typeof window !== 'undefined') {
    window.__totem_obs = { track, flush, shutdown };
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => flush());
    window.addEventListener('beforeunload', () => flush());
  }
}

function fetchWithTrace(input, init) {
  const f = state.origFetch || (typeof fetch !== 'undefined' ? fetch : null);
  if (!f) throw new Error('fetch unavailable');
  const tp = makeTraceparent();
  const traceId = tp.split('-')[1];
  const next = { ...(init || {}) };
  const headers = new Headers((init && init.headers) || (typeof input !== 'string' && input && input.headers) || {});
  headers.set('traceparent', tp);
  next.headers = headers;
  const start = Date.now();
  return f(input, next).then(
    (res) => {
      track({
        kind: 'fetch',
        latency_ms: Date.now() - start,
        outcome: res.ok ? 'ok' : 'error',
        error_class: res.ok ? undefined : classifyStatus(res.status),
        trace_id: traceId,
      });
      return res;
    },
    (err) => {
      track({ kind: 'fetch', latency_ms: Date.now() - start, outcome: 'error', error_class: 'network', trace_id: traceId });
      throw err;
    }
  );
}

function instrumentXhr() {
  if (state.xhrPatched) return;
  if (typeof XMLHttpRequest === 'undefined') return;
  const proto = XMLHttpRequest.prototype;
  const origOpen = proto.open;
  const origSend = proto.send;
  const origSetHeader = proto.setRequestHeader;
  state.origXhrOpen = origOpen;
  state.origXhrSend = origSend;
  state.origXhrSetHeader = origSetHeader;
  state.xhrPatched = true;
  proto.open = function patchedOpen(method, url) {
    this.__axia_obs = { method, url: String(url || ''), start: 0, traceId: null, headerSet: false };
    return origOpen.apply(this, arguments);
  };
  proto.setRequestHeader = function patchedSetHeader(name) {
    if (this.__axia_obs && /^traceparent$/i.test(String(name))) this.__axia_obs.headerSet = true;
    return origSetHeader.apply(this, arguments);
  };
  proto.send = function patchedSend() {
    const ctx = this.__axia_obs;
    if (!ctx) return origSend.apply(this, arguments);
    ctx.start = Date.now();
    if (isAxiaUrl(ctx.url) && !ctx.headerSet) {
      try {
        const tp = makeTraceparent();
        ctx.traceId = tp.split('-')[1];
        origSetHeader.call(this, 'traceparent', tp);
      } catch (_) {}
    }
    if (isAxiaUrl(ctx.url)) {
      const onEnd = () => {
        const status = this.status || 0;
        const ok = status >= 200 && status < 400;
        track({
          kind: 'xhr',
          latency_ms: Date.now() - ctx.start,
          outcome: ok ? 'ok' : 'error',
          error_class: ok ? undefined : classifyStatus(status),
          trace_id: ctx.traceId,
        });
      };
      this.addEventListener('loadend', onEnd, { once: true });
      this.addEventListener('error', () => {
        track({ kind: 'xhr', latency_ms: Date.now() - ctx.start, outcome: 'error', error_class: 'network', trace_id: ctx.traceId });
      }, { once: true });
    }
    return origSend.apply(this, arguments);
  };
}

function wrapTotemProvider(provider) {
  if (!provider || typeof provider.request !== 'function') return provider;
  const orig = provider.request.bind(provider);
  const kindMap = {
    TOTEM_CONNECT: 'connect',
    TOTEM_VERIFY: 'verify',
    TOTEM_GET_ACCOUNTS: 'get_accounts',
    TOTEM_SEND_TRANSACTION: 'send_tx',
    wots_sign: 'send_tx',
  };
  provider.request = async function tracked(arg) {
    const method = (arg && arg.method) || 'unknown';
    const kind = kindMap[method] || `provider_${method}`;
    const start = Date.now();
    try {
      const r = await orig(arg);
      track({ kind, latency_ms: Date.now() - start, outcome: 'ok' });
      return r;
    } catch (err) {
      track({ kind, latency_ms: Date.now() - start, outcome: 'error', error_class: classifyError(err) });
      throw err;
    }
  };
  return provider;
}

function shutdown() {
  state.queue.length = 0;
  if (state.timer) clearTimeout(state.timer);
  state.timer = null;
  if (state.fetchPatched && state.origFetch) {
    globalThis.fetch = state.origFetch;
    state.fetchPatched = false;
  }
  if (state.xhrPatched && typeof XMLHttpRequest !== 'undefined') {
    const proto = XMLHttpRequest.prototype;
    if (state.origXhrOpen) proto.open = state.origXhrOpen;
    if (state.origXhrSend) proto.send = state.origXhrSend;
    if (state.origXhrSetHeader) proto.setRequestHeader = state.origXhrSetHeader;
    state.xhrPatched = false;
  }
  if (state.providerPatched && typeof window !== 'undefined' && window.totem && state.origProviderRequest) {
    window.totem.request = state.origProviderRequest;
    state.providerPatched = false;
  }
  state.origFetch = null;
  state.origXhrOpen = null;
  state.origXhrSend = null;
  state.origXhrSetHeader = null;
  state.origProviderRequest = null;
  state.initialized = false;
  state.optOut = false;
  state.dappId = null;
  state.hmacSecret = null;
}

function attachProvider(provider) {
  if (!state.initialized || state.optOut) return provider;
  if (!provider || typeof provider.request !== 'function') return provider;
  if (state.providerPatched) return provider;
  if (typeof window !== 'undefined' && provider === window.totem) {
    instrumentTotemProvider();
    return window.totem;
  }
  return wrapTotemProvider(provider);
}

export { init, track, flush, shutdown, fetchWithTrace, makeTraceparent, wrapTotemProvider, attachProvider };
export default { init, track, flush, shutdown, fetchWithTrace, makeTraceparent, wrapTotemProvider, attachProvider };
