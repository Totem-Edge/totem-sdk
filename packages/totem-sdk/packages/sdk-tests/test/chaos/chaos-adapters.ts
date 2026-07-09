import type { StorageAdapter, HttpClient, LoggerAdapter, HttpResponse, HttpRequestOptions } from '@totemsdk/core';

export type StorageFailureMode = 
  | 'none'
  | 'write_failure'
  | 'read_failure'
  | 'quota_exceeded'
  | 'corruption'
  | 'random_failure'
  | 'timeout';

export type HttpFailureMode =
  | 'none'
  | 'timeout'
  | 'connection_refused'
  | 'server_error'
  | 'rate_limit'
  | 'corruption'
  | 'random_failure';

export type FailureMode = StorageFailureMode;

export interface ChaosConfig {
  failureMode: FailureMode;
  failureProbability: number;
  failAfterNOperations?: number;
  corruptionPattern?: 'truncate' | 'garbage' | 'partial';
}

export interface HttpChaosConfig {
  failureMode: HttpFailureMode;
  failureProbability: number;
  failAfterNOperations?: number;
  serverErrorCode?: number;
  retryAfter?: number;
  timeout?: number;
  corruptionPattern?: 'invalid_json' | 'truncated';
  defaultResponse?: HttpResponse<unknown>;
}

export class ChaosStorageAdapter implements StorageAdapter {
  private storage = new Map<string, unknown>();
  private operationCount = 0;
  private config: ChaosConfig;
  public failureLog: Array<{ op: string; key: string; error: string }> = [];
  public operationLog: Array<{ op: string; key: string; success: boolean }> = [];

  constructor(config: Partial<ChaosConfig> = {}) {
    this.config = {
      failureMode: 'none',
      failureProbability: 0.5,
      ...config,
    };
  }

  setConfig(config: Partial<ChaosConfig>): void {
    this.config = { ...this.config, ...config };
  }

  private shouldFail(): boolean {
    if (this.config.failureMode === 'none') return false;
    
    this.operationCount++;
    
    if (this.config.failAfterNOperations !== undefined) {
      return this.operationCount > this.config.failAfterNOperations;
    }
    
    if (this.config.failureMode === 'random_failure') {
      return Math.random() < this.config.failureProbability;
    }
    
    return true;
  }

  private logFailure(op: string, key: string, error: string): void {
    this.failureLog.push({ op, key, error });
    this.operationLog.push({ op, key, success: false });
  }

  private logSuccess(op: string, key: string): void {
    this.operationLog.push({ op, key, success: true });
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.config.failureMode === 'read_failure' && this.shouldFail()) {
      this.logFailure('get', key, 'Simulated read failure');
      throw new Error('ChaosStorage: Simulated read failure');
    }

    if (this.config.failureMode === 'timeout' && this.shouldFail()) {
      this.logFailure('get', key, 'Simulated timeout');
      await new Promise(resolve => setTimeout(resolve, 30000));
      throw new Error('ChaosStorage: Operation timed out');
    }

    if (this.config.failureMode === 'corruption' && this.shouldFail()) {
      const original = this.storage.get(key);
      if (original !== undefined) {
        this.logFailure('get', key, 'Returning corrupted data');
        return this.corruptData(original) as T;
      }
    }

    this.logSuccess('get', key);
    return (this.storage.get(key) as T) ?? null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    if (this.config.failureMode === 'write_failure' && this.shouldFail()) {
      this.logFailure('set', key, 'Simulated write failure');
      throw new Error('ChaosStorage: Simulated write failure');
    }

    if (this.config.failureMode === 'quota_exceeded' && this.shouldFail()) {
      this.logFailure('set', key, 'Storage quota exceeded');
      throw new DOMException('QuotaExceededError', 'QuotaExceededError');
    }

    if (this.config.failureMode === 'timeout' && this.shouldFail()) {
      this.logFailure('set', key, 'Simulated timeout');
      await new Promise(resolve => setTimeout(resolve, 30000));
      throw new Error('ChaosStorage: Operation timed out');
    }

    this.logSuccess('set', key);
    this.storage.set(key, value);
  }

  async remove(key: string): Promise<boolean> {
    if (this.config.failureMode === 'write_failure' && this.shouldFail()) {
      this.logFailure('remove', key, 'Simulated write failure');
      throw new Error('ChaosStorage: Simulated write failure');
    }

    this.logSuccess('remove', key);
    return this.storage.delete(key);
  }

  async clear(): Promise<void> {
    if (this.config.failureMode === 'write_failure' && this.shouldFail()) {
      this.logFailure('clear', '*', 'Simulated write failure');
      throw new Error('ChaosStorage: Simulated write failure');
    }

    this.logSuccess('clear', '*');
    this.storage.clear();
  }

  async keys(): Promise<string[]> {
    if (this.config.failureMode === 'read_failure' && this.shouldFail()) {
      this.logFailure('keys', '*', 'Simulated read failure');
      throw new Error('ChaosStorage: Simulated read failure');
    }

    this.logSuccess('keys', '*');
    return Array.from(this.storage.keys());
  }

  async has(key: string): Promise<boolean> {
    if (this.config.failureMode === 'read_failure' && this.shouldFail()) {
      this.logFailure('has', key, 'Simulated read failure');
      throw new Error('ChaosStorage: Simulated read failure');
    }

    this.logSuccess('has', key);
    return this.storage.has(key);
  }

  private corruptData(data: unknown): unknown {
    const pattern = this.config.corruptionPattern || 'garbage';
    
    if (typeof data === 'string') {
      switch (pattern) {
        case 'truncate':
          return data.slice(0, Math.floor(data.length / 2));
        case 'garbage':
          return 'CORRUPTED_' + Math.random().toString(36);
        case 'partial':
          return data.slice(0, -5) + 'XXXX';
        default:
          return data;
      }
    }
    
    if (typeof data === 'object' && data !== null) {
      return { __corrupted: true, originalType: typeof data };
    }
    
    return null;
  }

  reset(): void {
    this.storage.clear();
    this.operationCount = 0;
    this.failureLog = [];
    this.operationLog = [];
  }

  getStats(): { operations: number; failures: number; successRate: number } {
    const total = this.operationLog.length;
    const failures = this.failureLog.length;
    return {
      operations: total,
      failures,
      successRate: total > 0 ? (total - failures) / total : 1,
    };
  }
}

export class ChaosHttpClient implements HttpClient {
  private config: HttpChaosConfig;
  private requestCount = 0;
  public failureLog: Array<{ url: string; method: string; error: string }> = [];
  public requestLog: Array<{ url: string; method: string; success: boolean; error?: string }> = [];

  constructor(config: Partial<HttpChaosConfig> = {}) {
    this.config = {
      failureMode: 'none',
      failureProbability: 0.5,
      serverErrorCode: 500,
      retryAfter: 60,
      timeout: 30000,
      ...config,
    };
  }

  setConfig(config: Partial<HttpChaosConfig>): void {
    this.config = { ...this.config, ...config };
  }

  private shouldFail(): boolean {
    if (this.config.failureMode === 'none') return false;
    
    this.requestCount++;
    
    if (this.config.failAfterNOperations !== undefined) {
      return this.requestCount > this.config.failAfterNOperations;
    }
    
    if (this.config.failureMode === 'random_failure') {
      return Math.random() < this.config.failureProbability;
    }
    
    return true;
  }

  private logFailure(url: string, method: string, error: string): void {
    this.failureLog.push({ url, method, error });
    this.requestLog.push({ url, method, success: false, error });
  }

  private logSuccess(url: string, method: string): void {
    this.requestLog.push({ url, method, success: true });
  }

  async get<T>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T>> {
    return this.makeRequest<T>('GET', url, undefined, options);
  }

  async post<T>(url: string, body?: unknown, options?: HttpRequestOptions): Promise<HttpResponse<T>> {
    return this.makeRequest<T>('POST', url, body, options);
  }

  async put<T>(url: string, body?: unknown, options?: HttpRequestOptions): Promise<HttpResponse<T>> {
    return this.makeRequest<T>('PUT', url, body, options);
  }

  async delete<T>(url: string, options?: HttpRequestOptions): Promise<HttpResponse<T>> {
    return this.makeRequest<T>('DELETE', url, undefined, options);
  }

  private async makeRequest<T>(
    method: string,
    url: string,
    _body?: unknown,
    _options?: HttpRequestOptions
  ): Promise<HttpResponse<T>> {
    const mode = this.config.failureMode;

    if (mode === 'timeout' && this.shouldFail()) {
      this.logFailure(url, method, 'Request timeout');
      throw new Error('ChaosHttp: Request timed out');
    }

    if (mode === 'connection_refused' && this.shouldFail()) {
      this.logFailure(url, method, 'Connection refused');
      throw new Error('ChaosHttp: Connection refused');
    }

    if (mode === 'server_error' && this.shouldFail()) {
      const code = this.config.serverErrorCode || 500;
      this.logFailure(url, method, `HTTP ${code}`);
      return {
        ok: false,
        status: code,
        statusText: `Server Error ${code}`,
        headers: {},
        data: { error: `Chaos server error ${code}` } as T,
      };
    }

    if (mode === 'rate_limit' && this.shouldFail()) {
      this.logFailure(url, method, 'HTTP 429 rate limit');
      return {
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: {
          'retry-after': String(this.config.retryAfter || 60),
        },
        data: {
          jsonrpc: '2.0',
          error: {
            code: 429,
            message: 'Rate limit exceeded',
            data: { axia: { code: 42901, retryAfter: this.config.retryAfter } },
          },
        } as T,
      };
    }

    if (mode === 'corruption' && this.shouldFail()) {
      this.logFailure(url, method, 'Corrupted response');
      if (this.config.corruptionPattern === 'invalid_json') {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: {},
          data: 'not valid json {{{' as unknown as T,
        };
      }
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { truncated: true } as T,
      };
    }

    if (mode === 'random_failure' && this.shouldFail()) {
      const errorCode = [500, 502, 503, 504][Math.floor(Math.random() * 4)];
      this.logFailure(url, method, `HTTP ${errorCode}`);
      return {
        ok: false,
        status: errorCode,
        statusText: 'Chaos Error',
        headers: {},
        data: {} as T,
      };
    }

    this.logSuccess(url, method);
    
    if (this.config.defaultResponse) {
      return this.config.defaultResponse as HttpResponse<T>;
    }

    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {},
      data: { jsonrpc: '2.0', result: null, id: 1 } as T,
    };
  }

  reset(): void {
    this.requestCount = 0;
    this.failureLog = [];
    this.requestLog = [];
  }

  getStats(): { requests: number; failures: number; successRate: number } {
    const total = this.requestLog.length;
    const failures = this.failureLog.length;
    return {
      requests: total,
      failures,
      successRate: total > 0 ? (total - failures) / total : 1,
    };
  }
}

export interface TimerChaosConfig {
  skipMode: 'normal' | 'instant' | 'delayed';
  delayMultiplier: number;
}

export interface TimerAdapter {
  now(): number;
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
  setInterval(callback: () => void, ms: number): unknown;
  clearInterval(id: unknown): void;
}

export class ChaosTimerAdapter implements TimerAdapter {
  private config: TimerChaosConfig;
  private delayCount = 0;
  private timeoutCount = 0;

  constructor(config: Partial<TimerChaosConfig> = {}) {
    this.config = {
      skipMode: 'normal',
      delayMultiplier: 1,
      ...config,
    };
  }

  setConfig(config: Partial<TimerChaosConfig>): void {
    this.config = { ...this.config, ...config };
  }

  now(): number {
    return Date.now();
  }

  setTimeout(callback: () => void, ms: number): unknown {
    this.timeoutCount++;
    let actualDelay = ms;
    
    if (this.config.skipMode === 'instant') {
      actualDelay = 0;
    } else if (this.config.skipMode === 'delayed') {
      actualDelay = ms * this.config.delayMultiplier;
      this.delayCount++;
    }
    
    return global.setTimeout(callback, actualDelay);
  }

  clearTimeout(id: unknown): void {
    global.clearTimeout(id as NodeJS.Timeout);
  }

  setInterval(callback: () => void, ms: number): unknown {
    let actualDelay = ms;
    
    if (this.config.skipMode === 'instant') {
      actualDelay = 1;
    } else if (this.config.skipMode === 'delayed') {
      actualDelay = ms * this.config.delayMultiplier;
    }
    
    return global.setInterval(callback, actualDelay);
  }

  clearInterval(id: unknown): void {
    global.clearInterval(id as NodeJS.Timeout);
  }

  reset(): void {
    this.delayCount = 0;
    this.timeoutCount = 0;
  }

  getStats(): { delays: number; timeouts: number } {
    return {
      delays: this.delayCount,
      timeouts: this.timeoutCount,
    };
  }
}

export class ChaosLogger implements LoggerAdapter {
  public logs: Array<{ level: string; message: string; args: unknown[] }> = [];
  private shouldSuppressLogs: boolean;

  constructor(suppressLogs = true) {
    this.shouldSuppressLogs = suppressLogs;
  }

  debug(message: string, ...args: unknown[]): void {
    this.logs.push({ level: 'debug', message, args });
    if (!this.shouldSuppressLogs) console.debug(message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    this.logs.push({ level: 'info', message, args });
    if (!this.shouldSuppressLogs) console.info(message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.logs.push({ level: 'warn', message, args });
    if (!this.shouldSuppressLogs) console.warn(message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    this.logs.push({ level: 'error', message, args });
    if (!this.shouldSuppressLogs) console.error(message, ...args);
  }

  getLogsByLevel(level: string): Array<{ message: string; args: unknown[] }> {
    return this.logs.filter(l => l.level === level);
  }

  reset(): void {
    this.logs = [];
  }
}
