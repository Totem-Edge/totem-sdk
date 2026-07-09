/**
 * Extension Portfolio Module
 *
 * Singleton PortfolioStreamManager wired with chrome.storage.local adapter and
 * the chrome-extension-compatible WebSocket / fetch adapters from @totemsdk/realtime.
 *
 * Background script imports:
 *   import { portfolioStreamManager } from '../core/portfolio';
 */
import { PortfolioStreamManager, PortfolioCache } from '@totemsdk/realtime';
import type { PortfolioStreamConfig } from '@totemsdk/realtime';
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

// ── chrome.storage.local StorageAdapter ───────────────────────────────────────
const chromeStorageAdapter: StorageAdapter = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const result = await chrome.storage.local.get([key]);
      return result[key] as T ?? null;
    } catch { return null; }
  },
  async set<T>(key: string, value: T): Promise<void> {
    try { await chrome.storage.local.set({ [key]: value }); } catch { /* storage error */ }
  },
  async remove(key: string): Promise<boolean> {
    try {
      const result = await chrome.storage.local.get([key]);
      const had = key in result;
      await chrome.storage.local.remove([key]);
      return had;
    } catch { return false; }
  },
  async clear(): Promise<void> {
    try { await chrome.storage.local.clear(); } catch { /* ignore */ }
  },
  async keys(): Promise<string[]> {
    try {
      const raw = await chrome.storage.local.get(null);
      return Object.keys((raw as unknown as Record<string, unknown>) || {});
    } catch { return []; }
  },
  async has(key: string): Promise<boolean> {
    try {
      const result = await chrome.storage.local.get([key]);
      return key in result;
    } catch { return false; }
  },
};

// ── console LoggerAdapter ─────────────────────────────────────────────────────
const loggerAdapter: LoggerAdapter = {
  debug: (m: string, ...a: unknown[]) => console.debug(m, ...a),
  info:  (m: string, ...a: unknown[]) => console.info(m, ...a),
  warn:  (m: string, ...a: unknown[]) => console.warn(m, ...a),
  error: (m: string, ...a: unknown[]) => console.error(m, ...a),
};

// ── TimerAdapter ──────────────────────────────────────────────────────────────
const timerAdapter: TimerAdapter = {
  setTimeout:  (cb: () => void, ms: number): TimerHandle => setTimeout(cb, ms) as unknown as TimerHandle,
  setInterval: (cb: () => void, ms: number): TimerHandle => setInterval(cb, ms) as unknown as TimerHandle,
  clearTimeout:  (h: TimerHandle) => clearTimeout(h as unknown as ReturnType<typeof setTimeout>),
  clearInterval: (h: TimerHandle) => clearInterval(h as unknown as ReturnType<typeof setInterval>),
  now: () => Date.now(),
};

// ── fetch HttpClient ──────────────────────────────────────────────────────────
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
    return execFetch<T>(url, { method: 'GET' }, options);
  },
  post<T>(url: string, body?: unknown, options?: HttpRequestOptions): Promise<HttpResponse<T>> {
    return execFetch<T>(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(options?.headers ?? {}) },
      body: body != null ? JSON.stringify(body) : undefined,
    }, options);
  },
  put<T>(url: string, body?: unknown, options?: HttpRequestOptions): Promise<HttpResponse<T>> {
    return execFetch<T>(url, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', ...(options?.headers ?? {}) },
      body: body != null ? JSON.stringify(body) : undefined,
    }, options);
  },
  delete<T>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T>> {
    return execFetch<T>(url, { method: 'DELETE' }, options);
  },
};

// ── WebSocket adapter for service worker context ──────────────────────────────
class ExtWsClient implements WebSocketClient {
  private readonly _ws: WebSocket;
  private readonly _listeners = new Map<string, Set<(ev: unknown) => void>>();

  constructor(url: string, protocols?: string[]) {
    this._ws = protocols?.length ? new WebSocket(url, protocols) : new WebSocket(url);
    this._ws.onopen    = () => this._emit('open', { type: 'open' });
    this._ws.onmessage = (e: MessageEvent) => this._emit('message', { type: 'message', data: e.data });
    this._ws.onerror   = () => this._emit('error', { type: 'error', message: 'WebSocket error' });
    this._ws.onclose   = (e: CloseEvent) => this._emit('close', { type: 'close', code: e.code, reason: e.reason });
  }

  private _emit(event: string, ev: unknown) {
    this._listeners.get(event)?.forEach(fn => fn(ev));
  }

  get readyState(): number { return this._ws.readyState; }
  get url(): string { return this._ws.url; }

  send(data: string | Uint8Array | ArrayBuffer): void { this._ws.send(data as string | ArrayBufferLike); }
  close(code?: number, reason?: string): void { this._ws.close(code, reason); }
  terminate(): void { this._ws.close(1000, 'terminated'); }

  addEventListener<K extends keyof WebSocketEventMap>(event: K, listener: (ev: WebSocketEventMap[K]) => void): void {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event)!.add(listener as (ev: unknown) => void);
  }
  removeEventListener<K extends keyof WebSocketEventMap>(event: K, listener: (ev: WebSocketEventMap[K]) => void): void {
    this._listeners.get(event)?.delete(listener as (ev: unknown) => void);
  }
  removeAllListeners(): void { this._listeners.clear(); }

  set onopen(fn: ((ev: WebSocketEventMap['open']) => void) | null) { this._listeners.set('open', fn ? new Set([fn as (ev: unknown) => void]) : new Set()); }
  get onopen(): ((ev: WebSocketEventMap['open']) => void) | null { return null; }
  set onclose(fn: ((ev: WebSocketEventMap['close']) => void) | null) { this._listeners.set('close', fn ? new Set([fn as (ev: unknown) => void]) : new Set()); }
  get onclose(): ((ev: WebSocketEventMap['close']) => void) | null { return null; }
  set onmessage(fn: ((ev: WebSocketEventMap['message']) => void) | null) { this._listeners.set('message', fn ? new Set([fn as (ev: unknown) => void]) : new Set()); }
  get onmessage(): ((ev: WebSocketEventMap['message']) => void) | null { return null; }
  set onerror(fn: ((ev: WebSocketEventMap['error']) => void) | null) { this._listeners.set('error', fn ? new Set([fn as (ev: unknown) => void]) : new Set()); }
  get onerror(): ((ev: WebSocketEventMap['error']) => void) | null { return null; }
}

class ExtWsFactory implements WebSocketFactory {
  create(url: string, protocols?: string[], _options?: WebSocketFactoryOptions): WebSocketClient {
    return new ExtWsClient(url, protocols);
  }
  dispose(): void {}
}

// ── Singleton ─────────────────────────────────────────────────────────────────
const DEFAULT_BASE_URL  = 'https://api.axia.to';
const DEFAULT_PROJECT_ID = 'totem-shared';

const portfolioCache = new PortfolioCache(
  { storage: chromeStorageAdapter, logger: loggerAdapter, timer: { now: Date.now.bind(Date) } },
  {},
);

const config: PortfolioStreamConfig = {
  baseUrl:   DEFAULT_BASE_URL,
  projectId: DEFAULT_PROJECT_ID,
};

export const portfolioStreamManager = new PortfolioStreamManager(
  {
    websocket:     new ExtWsFactory(),
    http:          httpAdapter,
    logger:        loggerAdapter,
    timer:         timerAdapter,
    portfolioCache,
  },
  config,
);

export type { PortfolioStreamConfig };
