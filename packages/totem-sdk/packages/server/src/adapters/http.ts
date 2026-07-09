/**
 * Node.js HTTP Client Adapter
 * Provides HttpClient implementation using native fetch (Node 18+) or node-fetch@2
 */

import nodeFetch from 'node-fetch';
import type { RequestInit, Response as NodeFetchResponse } from 'node-fetch';
import type {
  HttpClient,
  HttpRequestOptions,
  HttpResponse,
} from '@totemsdk/core';

type FetchFunction = (url: string, init?: RequestInit) => Promise<NodeFetchResponse>;

const fetchImpl: FetchFunction = (typeof globalThis.fetch === 'function')
  ? globalThis.fetch.bind(globalThis) as unknown as FetchFunction
  : nodeFetch;

export interface NodeHttpClientOptions {
  defaultHeaders?: Record<string, string>;
  defaultTimeout?: number;
}

export class NodeHttpClient implements HttpClient {
  private readonly defaultHeaders: Record<string, string>;
  private readonly defaultTimeout: number;

  constructor(options: NodeHttpClientOptions = {}) {
    this.defaultHeaders = options.defaultHeaders ?? {};
    this.defaultTimeout = options.defaultTimeout ?? 30000;
  }

  private async request<T>(
    method: string,
    url: string,
    body?: unknown,
    options?: HttpRequestOptions
  ): Promise<HttpResponse<T>> {
    const controller = new AbortController();
    const timeout = options?.timeout ?? this.defaultTimeout;

    const timeoutId = setTimeout(() => controller.abort(), timeout);

    let cancelCleanup: (() => void) | undefined;
    if (options?.cancellationToken) {
      cancelCleanup = options.cancellationToken.onCancel(() => controller.abort());
    }

    try {
      const headers: Record<string, string> = {
        ...this.defaultHeaders,
        ...(options?.headers ?? {}),
      };

      if (body !== undefined && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }

      const response = await fetchImpl(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key.toLowerCase()] = value;
      });

      let data: T;
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        data = (await response.json()) as T;
      } else {
        const text = await response.text();
        data = text as unknown as T;
      }

      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        data,
      };
    } finally {
      clearTimeout(timeoutId);
      cancelCleanup?.();
    }
  }

  async get<T>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T>> {
    return this.request<T>('GET', url, undefined, options);
  }

  async post<T>(url: string, body?: unknown, options?: HttpRequestOptions): Promise<HttpResponse<T>> {
    return this.request<T>('POST', url, body, options);
  }

  async put<T>(url: string, body?: unknown, options?: HttpRequestOptions): Promise<HttpResponse<T>> {
    return this.request<T>('PUT', url, body, options);
  }

  async delete<T>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T>> {
    return this.request<T>('DELETE', url, undefined, options);
  }
}

export function createAuthedNodeHttpClient(
  getToken: () => Promise<string | null>,
  options: NodeHttpClientOptions = {}
): HttpClient {
  const baseClient = new NodeHttpClient(options);

  const addAuthHeader = async (
    opts?: HttpRequestOptions
  ): Promise<HttpRequestOptions> => {
    const token = await getToken();
    if (!token) return opts ?? {};

    return {
      ...opts,
      headers: {
        ...(opts?.headers ?? {}),
        Authorization: `Bearer ${token}`,
      },
    };
  };

  return {
    async get<T>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T>> {
      return baseClient.get<T>(url, await addAuthHeader(options));
    },
    async post<T>(url: string, body?: unknown, options?: HttpRequestOptions): Promise<HttpResponse<T>> {
      return baseClient.post<T>(url, body, await addAuthHeader(options));
    },
    async put<T>(url: string, body?: unknown, options?: HttpRequestOptions): Promise<HttpResponse<T>> {
      return baseClient.put<T>(url, body, await addAuthHeader(options));
    },
    async delete<T>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T>> {
      return baseClient.delete<T>(url, await addAuthHeader(options));
    },
  };
}
