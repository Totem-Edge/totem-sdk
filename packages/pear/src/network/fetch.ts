/**
 * BareFetch — thin fetch-compatible polyfill for Bare/Pear environments.
 *
 * In Pear/Bare, native `fetch` may be absent. This module provides a
 * `fetch`-compatible function backed by `bare-http1` (or `bare-http2`).
 *
 * Usage:
 *   import { bareFetch as fetch } from '@totemsdk/pear/network';
 *   const res = await fetch('https://api.example.com/data');
 *   const json = await res.json();
 *
 * When native `globalThis.fetch` is present (Node 18+, browsers) it is used
 * directly. The polyfill is only activated when `fetch` is absent.
 *
 * Bare-compatible: no `process.env`, no `__dirname`, no `require`.
 */

export interface FetchResponse {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  text(): Promise<string>;
  json<T = unknown>(): Promise<T>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface FetchInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Uint8Array;
  timeoutMs?: number;
}

/**
 * Polyfill-aware fetch.
 *
 * - In environments where `globalThis.fetch` exists: delegates to it.
 * - Otherwise: uses `bare-http1` (dynamic import) for HTTP/1.1 requests.
 */
export async function bareFetch(
  url: string,
  init: FetchInit = {},
): Promise<FetchResponse> {
  if (typeof globalThis.fetch === 'function') {
    const res = await globalThis.fetch(url, {
      method: init.method ?? 'GET',
      headers: init.headers,
      body: init.body instanceof Uint8Array ? Buffer.from(init.body) : init.body,
    });
    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      headers: Object.fromEntries(res.headers.entries()),
      text: () => res.text(),
      json: <T>() => res.json() as Promise<T>,
      arrayBuffer: () => res.arrayBuffer(),
    };
  }

  return _bareHttp1Fetch(url, init);
}

async function _bareHttp1Fetch(
  url: string,
  init: FetchInit,
): Promise<FetchResponse> {
  const http = await import('bare-http1' as string).catch(() => {
    throw new Error(
      'fetch is not available in this runtime. ' +
        "Install 'bare-http1' as a peer dependency or run in an environment with native fetch.",
    );
  });

  const parsed = new URL(url);
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = init.headers ?? {};
  const body =
    init.body instanceof Uint8Array
      ? Buffer.from(init.body)
      : init.body
        ? Buffer.from(init.body, 'utf-8')
        : undefined;

  if (body && !headers['content-length']) {
    headers['content-length'] = String(body.length);
  }

  const timeoutMs = init.timeoutMs ?? 30_000;

  return new Promise<FetchResponse>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`bareFetch timeout after ${timeoutMs}ms: ${url}`)),
      timeoutMs,
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req = (http as any).request(
      {
        protocol: parsed.protocol,
        host: parsed.hostname,
        port: parsed.port ? parseInt(parsed.port, 10) : parsed.protocol === 'https:' ? 443 : 80,
        path: parsed.pathname + parsed.search,
        method,
        headers,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (res: any) => {
        clearTimeout(timer);
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          const responseHeaders: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers ?? {})) {
            responseHeaders[k] = String(v);
          }
          const status: number = res.statusCode ?? 0;
          resolve({
            ok: status >= 200 && status < 300,
            status,
            statusText: res.statusMessage ?? '',
            headers: responseHeaders,
            text: async () => buf.toString('utf-8'),
            json: async <T>() => JSON.parse(buf.toString('utf-8')) as T,
            arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
          });
        });
        res.on('error', reject);
      },
    );

    req.on('error', (err: Error) => {
      clearTimeout(timer);
      reject(err);
    });

    if (body) req.write(body);
    req.end();
  });
}
