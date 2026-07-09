/**
 * portfolioStream — singleton PortfolioStreamManager wired with browser adapters.
 *
 * Uses @totemsdk/realtime's PortfolioStreamManager (WebSocket + HTTP fallback)
 * for live portfolio updates.
 *
 * All adapter implementations are pure browser-API shims — no external deps.
 */
import {
  PortfolioStreamManager,
  PortfolioCache,
} from '@totemsdk/realtime';
import type {
  PortfolioStreamConfig,
} from '@totemsdk/realtime';
import type {
  StorageAdapter,
  WebSocketFactory,
  WebSocketClient,
  WebSocketEventMap,
  WebSocketFactoryOptions,
  HttpClient,
  HttpRequestOptions,
  HttpResponse,
  TimerAdapter,
  LoggerAdapter,
  TimerHandle,
} from '@totemsdk/core';

// ── localStorage StorageAdapter ───────────────────────────────────────────────
const storageAdapter: StorageAdapter = {
  async get<T>(key: string): Promise<T | null> {
    try { return JSON.parse(localStorage.getItem(key) ?? 'null') as T; }
    catch { return null; }
  },
  async set<T>(key: string, value: T): Promise<void> {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
  },
  async remove(key: string): Promise<boolean> {
    const had = localStorage.getItem(key) !== null;
    localStorage.removeItem(key);
    return had;
  },
  async clear(): Promise<void> { localStorage.clear(); },
  async keys(): Promise<string[]> { return Object.keys(localStorage); },
  async has(key: string): Promise<boolean> {
    return localStorage.getItem(key) !== null;
  },
};

// ── console LoggerAdapter ─────────────────────────────────────────────────────
const loggerAdapter: LoggerAdapter = {
  debug: (m: string, ...a: unknown[]) => console.debug('[PortfolioStream]', m, ...a),
  info:  (m: string, ...a: unknown[]) => console.info('[PortfolioStream]', m, ...a),
  warn:  (m: string, ...a: unknown[]) => console.warn('[PortfolioStream]', m, ...a),
  error: (m: string, ...a: unknown[]) => console.error('[PortfolioStream]', m, ...a),
};

// ── window TimerAdapter ───────────────────────────────────────────────────────
const timerAdapter: TimerAdapter = {
  setTimeout:  (cb: () => void, ms: number): TimerHandle => window.setTimeout(cb, ms) as unknown as TimerHandle,
  setInterval: (cb: () => void, ms: number): TimerHandle => window.setInterval(cb, ms) as unknown as TimerHandle,
  clearTimeout:  (h: TimerHandle) => window.clearTimeout(h as unknown as number),
  clearInterval: (h: TimerHandle) => window.clearInterval(h as unknown as number),
  now: () => Date.now(),
};

// ── fetch HttpClient ──────────────────────────────────────────────────────────
async function doFetch<T>(
  url: string,
  init: RequestInit,
  options?: HttpRequestOptions,
): Promise<HttpResponse<T>> {
  if (options?.timeout) {
    const ac = new AbortController();
    const tid = setTimeout(() => ac.abort(), options.timeout);
    init.signal = ac.signal;
    try {
      return await execFetch<T>(url, init, options);
    } finally {
      clearTimeout(tid);
    }
  }
  return execFetch<T>(url, init, options);
}

async function execFetch<T>(
  url: string,
  init: RequestInit,
  options?: HttpRequestOptions,
): Promise<HttpResponse<T>> {
  const res = await fetch(url, {
    ...init,
    headers: { ...init.headers, ...(options?.headers ?? {}) },
  });
  let data: T;
  try { data = await res.json() as T; } catch { data = null as unknown as T; }
  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => { headers[k] = v; });
  return { ok: res.ok, status: res.status, statusText: res.statusText, headers, data };
}

const httpAdapter: HttpClient = {
  get<T>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T>> {
    return doFetch<T>(url, { method: 'GET' }, options);
  },
  post<T>(url: string, body?: unknown, options?: HttpRequestOptions): Promise<HttpResponse<T>> {
    return doFetch<T>(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(options?.headers ?? {}) },
      body: body != null ? JSON.stringify(body) : undefined,
    }, options);
  },
  put<T>(url: string, body?: unknown, options?: HttpRequestOptions): Promise<HttpResponse<T>> {
    return doFetch<T>(url, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', ...(options?.headers ?? {}) },
      body: body != null ? JSON.stringify(body) : undefined,
    }, options);
  },
  delete<T>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T>> {
    return doFetch<T>(url, { method: 'DELETE' }, options);
  },
};

// ── native WebSocket → WebSocketClient adapter ────────────────────────────────
class BrowserWsClient implements WebSocketClient {
  private readonly _ws: WebSocket;
  private readonly _listeners = new Map<string, Set<(ev: unknown) => void>>();

  constructor(url: string, protocols?: string[]) {
    this._ws = protocols?.length
      ? new WebSocket(url, protocols)
      : new WebSocket(url);

    this._ws.onopen    = () => this._emit('open',    { type: 'open' });
    this._ws.onmessage = (e: MessageEvent) =>
      this._emit('message', { type: 'message', data: e.data });
    this._ws.onerror   = () =>
      this._emit('error', { type: 'error', message: 'WebSocket error' });
    this._ws.onclose   = (e: CloseEvent) =>
      this._emit('close', { type: 'close', code: e.code, reason: e.reason, wasClean: e.wasClean });
  }

  private _emit(event: string, ev: unknown) {
    const set = this._listeners.get(event);
    if (set) set.forEach(fn => fn(ev));
  }

  get readyState(): number { return this._ws.readyState; }
  get url(): string { return this._ws.url; }

  send(data: string | Uint8Array | ArrayBuffer): void {
    this._ws.send(data as string | ArrayBufferLike);
  }
  close(code?: number, reason?: string): void { this._ws.close(code, reason); }
  terminate(): void { this._ws.close(1000, 'terminated'); }

  addEventListener<K extends keyof WebSocketEventMap>(
    event: K,
    listener: (ev: WebSocketEventMap[K]) => void,
  ): void {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event)!.add(listener as (ev: unknown) => void);
  }

  removeEventListener<K extends keyof WebSocketEventMap>(
    event: K,
    listener: (ev: WebSocketEventMap[K]) => void,
  ): void {
    this._listeners.get(event)?.delete(listener as (ev: unknown) => void);
  }

  removeAllListeners(): void { this._listeners.clear(); }

  set onopen(fn: ((ev: WebSocketEventMap['open']) => void) | null) {
    this._listeners.set('open', fn ? new Set([fn as (ev: unknown) => void]) : new Set());
  }
  get onopen(): ((ev: WebSocketEventMap['open']) => void) | null { return null; }

  set onclose(fn: ((ev: WebSocketEventMap['close']) => void) | null) {
    this._listeners.set('close', fn ? new Set([fn as (ev: unknown) => void]) : new Set());
  }
  get onclose(): ((ev: WebSocketEventMap['close']) => void) | null { return null; }

  set onmessage(fn: ((ev: WebSocketEventMap['message']) => void) | null) {
    this._listeners.set('message', fn ? new Set([fn as (ev: unknown) => void]) : new Set());
  }
  get onmessage(): ((ev: WebSocketEventMap['message']) => void) | null { return null; }

  set onerror(fn: ((ev: WebSocketEventMap['error']) => void) | null) {
    this._listeners.set('error', fn ? new Set([fn as (ev: unknown) => void]) : new Set());
  }
  get onerror(): ((ev: WebSocketEventMap['error']) => void) | null { return null; }
}

class BrowserWsFactory implements WebSocketFactory {
  create(url: string, protocols?: string[], _options?: WebSocketFactoryOptions): WebSocketClient {
    return new BrowserWsClient(url, protocols);
  }
  dispose(): void { /* nothing to tear down globally */ }
}

// ── Assemble singleton manager ────────────────────────────────────────────────
const API_BASE   = import.meta.env.VITE_AXIA_API_BASE   ?? 'https://api.axia.to';
const PROJECT_ID = import.meta.env.VITE_AXIA_PROJECT_ID ?? 'totem-shared';

const portfolioCacheInst = new PortfolioCache(
  { storage: storageAdapter, logger: loggerAdapter, timer: { now: Date.now.bind(Date) } },
  {},
);

const config: PortfolioStreamConfig = {
  baseUrl: API_BASE,
  projectId: PROJECT_ID,
};

export const portfolioStreamManager = new PortfolioStreamManager(
  {
    websocket:     new BrowserWsFactory(),
    http:          httpAdapter,
    logger:        loggerAdapter,
    timer:         timerAdapter,
    portfolioCache: portfolioCacheInst,
  },
  config,
);
