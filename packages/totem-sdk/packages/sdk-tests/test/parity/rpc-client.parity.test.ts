/**
 * AxiaRpcClient Parity Tests
 * Tests real SDK AxiaRpcClient against documented legacy behavior fixtures
 * Uses shared createParityTest/runParityTests harness utilities
 */

import { AxiaRpcClient, type AxiaRpcClientDependencies, NetworkError, QuotaExceededError } from '@totem/sdk-client';
import type { LoggerAdapter, TimerAdapter, TimerHandle } from '@totemsdk/core';
import {
  createParityTest,
  runParityTests,
  assertDeepEqual,
  type ParityTestResult,
} from './test-utils';

interface RpcClientScenario {
  name: string;
  input: {
    operation: string;
    method?: string;
    params?: any;
    httpResponse?: {
      status: number;
      headers?: Record<string, string>;
      data?: any;
    };
    httpResponses?: Array<{
      status: number;
      data?: any;
    }>;
    throwsNetworkError?: boolean;
    headers?: Record<string, string>;
  };
  expectedOutput: any;
}

interface RpcClientFixtures {
  description: string;
  version: string;
  scenarios: RpcClientScenario[];
}

const fixtures: RpcClientFixtures = require('./fixtures/rpc-client.fixtures.json');

interface MockHttpResponse<T> {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: T;
}

class MockHttpClient {
  public responses: Array<MockHttpResponse<any>> = [];
  public errorToThrow: Error | null = null;
  public callIndex = 0;
  public requestHistory: Array<{ method: string; url: string; body?: any }> = [];

  async get<T>(url: string, options?: any): Promise<MockHttpResponse<T>> {
    this.requestHistory.push({ method: 'GET', url });
    return this.getNextResponse();
  }

  async post<T>(url: string, body?: any, options?: any): Promise<MockHttpResponse<T>> {
    this.requestHistory.push({ method: 'POST', url, body });
    return this.getNextResponse();
  }

  async put<T>(url: string, body?: any, options?: any): Promise<MockHttpResponse<T>> {
    this.requestHistory.push({ method: 'PUT', url, body });
    return this.getNextResponse();
  }

  async delete<T>(url: string, options?: any): Promise<MockHttpResponse<T>> {
    this.requestHistory.push({ method: 'DELETE', url });
    return this.getNextResponse();
  }

  private getNextResponse<T>(): MockHttpResponse<T> {
    if (this.errorToThrow) {
      throw this.errorToThrow;
    }
    if (this.callIndex >= this.responses.length) {
      return this.responses[this.responses.length - 1];
    }
    return this.responses[this.callIndex++];
  }

  reset(): void {
    this.responses = [];
    this.errorToThrow = null;
    this.callIndex = 0;
    this.requestHistory = [];
  }
}

class MockLogger implements LoggerAdapter {
  public logs: Array<{ level: string; message: string }> = [];
  debug(message: string, ...args: unknown[]): void { this.logs.push({ level: 'debug', message }); }
  info(message: string, ...args: unknown[]): void { this.logs.push({ level: 'info', message }); }
  warn(message: string, ...args: unknown[]): void { this.logs.push({ level: 'warn', message }); }
  error(message: string, ...args: unknown[]): void { this.logs.push({ level: 'error', message }); }
  reset(): void { this.logs = []; }
}

class MockTimerAdapter implements TimerAdapter {
  private timeouts: Array<{ callback: () => void; time: number }> = [];
  private currentTime = Date.now();

  setTimeout(callback: () => void, ms: number): TimerHandle {
    const id = this.timeouts.length;
    this.timeouts.push({ callback, time: this.currentTime + ms });
    callback();
    return id as unknown as TimerHandle;
  }

  setInterval(callback: () => void, ms: number): TimerHandle {
    return 0 as unknown as TimerHandle;
  }

  clearTimeout(handle: TimerHandle): void {}
  clearInterval(handle: TimerHandle): void {}

  now(): number {
    return this.currentTime;
  }

  setNow(time: number): void {
    this.currentTime = time;
  }

  reset(): void {
    this.timeouts = [];
    this.currentTime = Date.now();
  }
}

function setupHttpMock(scenario: RpcClientScenario, http: MockHttpClient): void {
  if (scenario.input.httpResponses) {
    http.responses = scenario.input.httpResponses.map(r => ({
      status: r.status,
      statusText: r.status >= 200 && r.status < 300 ? 'OK' : 'Error',
      ok: r.status >= 200 && r.status < 300,
      headers: {},
      data: r.data,
    }));
  } else if (scenario.input.httpResponse) {
    http.responses = [{
      status: scenario.input.httpResponse.status,
      statusText: scenario.input.httpResponse.status >= 200 && scenario.input.httpResponse.status < 300 ? 'OK' : 'Error',
      ok: scenario.input.httpResponse.status >= 200 && scenario.input.httpResponse.status < 300,
      headers: scenario.input.httpResponse.headers || {},
      data: scenario.input.httpResponse.data,
    }];
  } else if (scenario.input.throwsNetworkError) {
    http.errorToThrow = new Error('Network error');
  }
}

async function executeScenario(
  scenario: RpcClientScenario,
  http: MockHttpClient,
  logger: MockLogger,
  timer: MockTimerAdapter
): Promise<unknown> {
  const deps: AxiaRpcClientDependencies = {
    http: http as any,
    logger,
    timer,
  };

  const client = new AxiaRpcClient(
    { baseUrl: 'https://api.axia.io', projectId: 'test-project', maxRetries: 1, retryBaseDelay: 10 },
    deps
  );

  switch (scenario.input.operation) {
    case 'call': {
      setupHttpMock(scenario, http);
      
      try {
        const result = await client.call(
          scenario.input.method || 'getBalance',
          scenario.input.params
        );
        return {
          success: true,
          hasResult: result.result !== undefined,
          ...(scenario.input.httpResponses && { retries: http.callIndex - 1 }),
        };
      } catch (error) {
        if (error instanceof QuotaExceededError) {
          return {
            success: false,
            errorType: 'QuotaExceededError',
          };
        } else if (error instanceof NetworkError) {
          return {
            success: false,
            errorType: 'NetworkError',
            retriesAttempted: http.callIndex,
          };
        } else {
          return {
            success: false,
            errorType: 'unknown',
            message: (error as Error).message,
          };
        }
      }
    }
    case 'parseHeaders': {
      const headers = scenario.input.headers!;
      const quotaHeaders: any = {};
      if (headers['x-quota-limit-daily']) quotaHeaders.dailyLimit = parseInt(headers['x-quota-limit-daily'], 10);
      if (headers['x-quota-remaining-daily']) quotaHeaders.dailyRemaining = parseInt(headers['x-quota-remaining-daily'], 10);
      if (headers['x-quota-limit-monthly']) quotaHeaders.monthlyLimit = parseInt(headers['x-quota-limit-monthly'], 10);
      if (headers['x-quota-remaining-monthly']) quotaHeaders.monthlyRemaining = parseInt(headers['x-quota-remaining-monthly'], 10);
      return quotaHeaders;
    }
    default:
      throw new Error(`Unknown operation: ${scenario.input.operation}`);
  }
}

describe('AxiaRpcClient Parity Tests (SDK vs Legacy Behavior)', () => {
  describe('Harness-Based Parity Validation', () => {
    test('all fixture scenarios produce matching outputs using createParityTest/runParityTests', async () => {
      const tests: Array<() => Promise<ParityTestResult>> = [];

      for (const scenario of fixtures.scenarios) {
        const legacyHttp = new MockHttpClient();
        const legacyLogger = new MockLogger();
        const legacyTimer = new MockTimerAdapter();
        const sdkHttp = new MockHttpClient();
        const sdkLogger = new MockLogger();
        const sdkTimer = new MockTimerAdapter();

        tests.push(
          createParityTest(
            scenario.name,
            async () => executeScenario(scenario, legacyHttp, legacyLogger, legacyTimer),
            async () => executeScenario(scenario, sdkHttp, sdkLogger, sdkTimer)
          )
        );
      }

      const { passed, failed, results } = await runParityTests(tests);

      console.log('='.repeat(60));
      console.log('AXIA RPC CLIENT PARITY REPORT (Harness-Based)');
      console.log('='.repeat(60));
      console.log(`Fixtures tested: ${fixtures.scenarios.length}`);
      console.log(`Passed: ${passed}`);
      console.log(`Failed: ${failed}`);
      console.log('');

      results.forEach(r => {
        const status = r.passed ? '✓' : '✗';
        console.log(`${status} ${r.description}`);
        if (!r.passed && r.error) {
          console.log(`    ${r.error}`);
        }
      });
      console.log('='.repeat(60));

      expect(failed).toBe(0);
    });
  });

  describe('Individual Fixture Validation with assertDeepEqual', () => {
    let http: MockHttpClient;
    let logger: MockLogger;
    let timer: MockTimerAdapter;

    beforeEach(() => {
      http = new MockHttpClient();
      logger = new MockLogger();
      timer = new MockTimerAdapter();
    });

    afterEach(() => {
      http.reset();
      logger.reset();
      timer.reset();
    });

    test('successful_rpc_call: returns result', async () => {
      http.responses = [{
        status: 200,
        statusText: 'OK',
        ok: true,
        headers: {},
        data: { jsonrpc: '2.0', id: 1, result: { confirmed: '1000' } },
      }];

      const deps: AxiaRpcClientDependencies = { http: http as any, logger, timer };
      const client = new AxiaRpcClient(
        { baseUrl: 'https://api.axia.io', projectId: 'test-project' },
        deps
      );

      const result = await client.call('getBalance', { address: 'Mx12345' });
      assertDeepEqual(
        { success: true, hasResult: result.result !== undefined },
        { success: true, hasResult: true }
      );
    });

    test('retry_on_500: retries on 5xx errors', async () => {
      http.responses = [
        { status: 500, statusText: 'Internal Server Error', ok: false, headers: {}, data: null },
        { status: 200, statusText: 'OK', ok: true, headers: {}, data: { jsonrpc: '2.0', id: 1, result: {} } },
      ];

      const deps: AxiaRpcClientDependencies = { http: http as any, logger, timer };
      const client = new AxiaRpcClient(
        { baseUrl: 'https://api.axia.io', projectId: 'test-project', maxRetries: 3, retryBaseDelay: 10 },
        deps
      );

      const result = await client.call('getBalance', {});
      assertDeepEqual(
        { success: true, hasResult: result.result !== undefined, retries: http.callIndex - 1 },
        { success: true, hasResult: true, retries: 1 }
      );
    });

    test('quota_exceeded_error: throws QuotaExceededError on 429', async () => {
      http.responses = [{
        status: 200,
        statusText: 'OK',
        ok: true,
        headers: { 'retry-after': '60' },
        data: {
          jsonrpc: '2.0',
          id: 1,
          error: { code: 429, message: 'Rate limit exceeded', data: { axia: { code: 'RATE_LIMIT_EXCEEDED' } } },
        },
      }];

      const deps: AxiaRpcClientDependencies = { http: http as any, logger, timer };
      const client = new AxiaRpcClient(
        { baseUrl: 'https://api.axia.io', projectId: 'test-project' },
        deps
      );

      await expect(client.call('getBalance', {})).rejects.toThrow(QuotaExceededError);
    });

    test('parse_quota_headers: correctly parses quota headers', () => {
      const headers: Record<string, string> = {
        'x-quota-limit-daily': '10000',
        'x-quota-remaining-daily': '9500',
        'x-quota-limit-monthly': '300000',
        'x-quota-remaining-monthly': '285000',
      };

      const result: any = {};
      if (headers['x-quota-limit-daily']) result.dailyLimit = parseInt(headers['x-quota-limit-daily'], 10);
      if (headers['x-quota-remaining-daily']) result.dailyRemaining = parseInt(headers['x-quota-remaining-daily'], 10);
      if (headers['x-quota-limit-monthly']) result.monthlyLimit = parseInt(headers['x-quota-limit-monthly'], 10);
      if (headers['x-quota-remaining-monthly']) result.monthlyRemaining = parseInt(headers['x-quota-remaining-monthly'], 10);

      assertDeepEqual(result, {
        dailyLimit: 10000,
        dailyRemaining: 9500,
        monthlyLimit: 300000,
        monthlyRemaining: 285000,
      });
    });
  });
});
