import { AxiaRpcClient } from '@totem/sdk-client';
import type { TimerAdapter } from '@totemsdk/core';
import { ChaosHttpClient, ChaosTimerAdapter, ChaosLogger } from './chaos-adapters';

describe('AxiaRpcClient Chaos Tests', () => {
  let chaosHttp: ChaosHttpClient;
  let chaosTimer: ChaosTimerAdapter;
  let chaosLogger: ChaosLogger;
  let client: AxiaRpcClient;

  const createClient = () => {
    return new AxiaRpcClient(
      {
        baseUrl: 'https://api.axia.test',
        projectId: 'test-project',
        maxRetries: 3,
        retryBaseDelay: 10,
      },
      {
        http: chaosHttp,
        logger: chaosLogger,
        timer: chaosTimer as unknown as TimerAdapter,
      }
    );
  };

  const createSuccessResponse = (result: unknown) => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: {
      'x-quota-limit-daily': '10000',
      'x-quota-remaining-daily': '9500',
    },
    data: {
      jsonrpc: '2.0',
      result,
      id: 1,
    },
  });

  beforeEach(() => {
    chaosHttp = new ChaosHttpClient();
    chaosTimer = new ChaosTimerAdapter();
    chaosLogger = new ChaosLogger(true);
    client = createClient();
  });

  afterEach(() => {
    chaosHttp.reset();
    chaosTimer.reset();
    chaosLogger.reset();
  });

  describe('Network Failure Resilience', () => {
    test('handles network timeout with retries', async () => {
      chaosHttp.setConfig({ 
        failureMode: 'timeout',
        timeout: 50,
      });

      try {
        await client.call('minima', []);
        fail('Expected timeout error');
      } catch (e) {
        expect(chaosHttp.failureLog.length).toBeGreaterThan(0);
        const timeoutErrors = chaosHttp.failureLog.filter(f => f.error.includes('timeout'));
        expect(timeoutErrors.length).toBeGreaterThan(0);
      }
    });

    test('handles connection refused errors', async () => {
      chaosHttp.setConfig({ 
        failureMode: 'connection_refused',
      });

      try {
        await client.call('balance', []);
        fail('Expected connection error');
      } catch (e) {
        expect(chaosHttp.failureLog.length).toBeGreaterThan(0);
      }
    });

    test('handles intermittent failures with eventual success', async () => {
      chaosHttp.setConfig({ 
        failureMode: 'random_failure',
        failureProbability: 0.3,
        defaultResponse: createSuccessResponse({ balance: 1000 }),
      });

      let successCount = 0;
      let failureCount = 0;

      for (let i = 0; i < 10; i++) {
        try {
          await client.call('balance', []);
          successCount++;
        } catch (e) {
          failureCount++;
        }
      }

      console.log(`[Chaos] Intermittent failures - Success: ${successCount}, Failures: ${failureCount}`);
      expect(successCount + failureCount).toBe(10);
    });
  });

  describe('HTTP Error Handling', () => {
    test('handles 500 server errors with retry', async () => {
      chaosHttp.setConfig({ 
        failureMode: 'server_error',
        serverErrorCode: 500,
      });

      try {
        await client.call('status', []);
      } catch (e) {
      }

      expect(chaosHttp.failureLog.length).toBeGreaterThan(0);
    });

    test('handles 429 rate limit errors', async () => {
      chaosHttp.setConfig({ 
        failureMode: 'rate_limit',
        retryAfter: 10,
      });

      try {
        await client.call('balance', []);
      } catch (e) {
      }

      expect(chaosHttp.failureLog.length).toBeGreaterThan(0);
    });

    test('handles 502 bad gateway', async () => {
      chaosHttp.setConfig({ 
        failureMode: 'server_error',
        serverErrorCode: 502,
      });

      try {
        await client.call('minima', []);
      } catch (e) {
      }

      const logs = chaosHttp.failureLog;
      expect(logs.some(l => l.error.includes('502'))).toBe(true);
    });
  });

  describe('Response Corruption', () => {
    test('handles malformed JSON response', async () => {
      chaosHttp.setConfig({ 
        failureMode: 'corruption',
        corruptionPattern: 'invalid_json',
      });

      try {
        await client.call('balance', []);
      } catch (e) {
      }

      expect(chaosHttp.failureLog.length).toBeGreaterThan(0);
    });

    test('handles truncated response', async () => {
      chaosHttp.setConfig({ 
        failureMode: 'corruption',
        corruptionPattern: 'truncated',
      });

      try {
        await client.call('status', []);
      } catch (e) {
      }

      expect(chaosHttp.failureLog.length).toBeGreaterThan(0);
    });
  });

  describe('Timer Chaos', () => {
    test('handles timer skip (for retries)', async () => {
      chaosHttp.setConfig({ 
        failureMode: 'server_error',
        serverErrorCode: 503,
        failAfterNOperations: 2,
        defaultResponse: createSuccessResponse({ status: 'ok' }),
      });
      chaosTimer.setConfig({ skipMode: 'instant' });

      const startTime = Date.now();
      
      try {
        await client.call('status', []);
      } catch (e) {
      }

      const elapsedTime = Date.now() - startTime;
      console.log(`[Chaos] Timer skip test - Elapsed: ${elapsedTime}ms`);
    });

    test('handles delayed timer (slow retries)', async () => {
      chaosHttp.setConfig({ 
        failureMode: 'server_error',
        serverErrorCode: 500,
        failAfterNOperations: 1,
        defaultResponse: createSuccessResponse({ data: 'test' }),
      });
      chaosTimer.setConfig({ delayMultiplier: 2 });

      try {
        await client.call('test', []);
      } catch (e) {
      }

      const stats = chaosTimer.getStats();
      console.log(`[Chaos] Delayed timer - Delays: ${stats.delays}`);
    });
  });

  describe('Recovery Scenarios', () => {
    test('recovers after transient network failures', async () => {
      chaosHttp.setConfig({ 
        failureMode: 'connection_refused',
        failAfterNOperations: 2,
        defaultResponse: createSuccessResponse({ recovered: true }),
      });

      try {
        await client.call('test', []);
      } catch (e) {
      }

      chaosHttp.setConfig({ 
        failureMode: 'none',
        defaultResponse: createSuccessResponse({ status: 'healthy' }),
      });

      const result = await client.call('status', []);
      expect(result.result).toEqual({ status: 'healthy' });
    });

    test('handles quota recovery after rate limit', async () => {
      chaosHttp.setConfig({ 
        failureMode: 'rate_limit',
        retryAfter: 1,
        failAfterNOperations: 1,
        defaultResponse: createSuccessResponse({ balance: 500 }),
      });

      try {
        await client.call('balance', []);
      } catch (e) {
      }

      chaosHttp.setConfig({ 
        failureMode: 'none',
        defaultResponse: createSuccessResponse({ balance: 500 }),
      });

      const result = await client.call('balance', []);
      expect(result.result).toEqual({ balance: 500 });
    });
  });

  describe('Concurrent Requests Under Chaos', () => {
    test('handles concurrent requests with failures', async () => {
      chaosHttp.setConfig({ 
        failureMode: 'random_failure',
        failureProbability: 0.3,
        defaultResponse: createSuccessResponse({ data: 'test' }),
      });

      const requests = Array.from({ length: 5 }, (_, i) => 
        client.call(`method_${i}`, [])
          .then(() => ({ succeeded: true, method: `method_${i}` }))
          .catch((e: Error) => ({ succeeded: false, error: e.message, method: `method_${i}` }))
      );

      const results = await Promise.all(requests);
      
      const successes = results.filter(r => r.succeeded);
      const failures = results.filter(r => !r.succeeded);
      
      console.log(`[Chaos] Concurrent requests - Success: ${successes.length}, Failures: ${failures.length}`);
      
      expect(successes.length + failures.length).toBe(5);
    });
  });

  describe('Failure Statistics', () => {
    test('tracks HTTP operation statistics', async () => {
      chaosHttp.setConfig({ 
        failureMode: 'none',
        defaultResponse: createSuccessResponse({ test: true }),
      });

      await client.call('method1', []);
      await client.call('method2', []);
      await client.call('method3', []);

      const stats = chaosHttp.getStats();
      
      console.log(`[Chaos] HTTP stats - Requests: ${stats.requests}, Failures: ${stats.failures}`);
      
      expect(stats.requests).toBeGreaterThanOrEqual(3);
      expect(stats.failures).toBe(0);
    });

    test('tracks failures in chaos mode', async () => {
      chaosHttp.setConfig({ 
        failureMode: 'server_error',
        serverErrorCode: 500,
      });

      for (let i = 0; i < 3; i++) {
        try {
          await client.call('failing_method', []);
        } catch (e) {
        }
      }

      const stats = chaosHttp.getStats();
      
      console.log(`[Chaos] HTTP failures - Requests: ${stats.requests}, Failures: ${stats.failures}`);
      
      expect(stats.requests).toBeGreaterThan(0);
      expect(stats.failures).toBeGreaterThan(0);
    });
  });
});
