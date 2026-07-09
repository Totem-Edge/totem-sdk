/**
 * TransactionService Parity Tests
 * Compares SDK TransactionService with expected behavior for migration safety
 */

import { TransactionService, type TransactionServiceConfig, type WotsSigningDependencies } from '../../src/tx';
import type { HttpClient, HttpResponse, HttpRequestOptions } from '../../src/adapters';
import { MockLogger } from './test-utils';

const createMockHttpClient = (): HttpClient & { 
  setResponse: <T>(response: HttpResponse<T>) => void;
  setError: (error: Error) => void;
  getLastRequest: () => { url: string; body?: unknown; options?: HttpRequestOptions } | null;
} => {
  let nextResponse: HttpResponse<unknown> = {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: {},
    data: {},
  };
  let nextError: Error | null = null;
  let lastRequest: { url: string; body?: unknown; options?: HttpRequestOptions } | null = null;

  const request = async <T>(url: string, body?: unknown, options?: HttpRequestOptions): Promise<HttpResponse<T>> => {
    lastRequest = { url, body, options };
    if (nextError) {
      const error = nextError;
      nextError = null;
      throw error;
    }
    return nextResponse as HttpResponse<T>;
  };

  return {
    get: <T>(url: string, options?: HttpRequestOptions) => request<T>(url, undefined, options),
    post: <T>(url: string, body?: unknown, options?: HttpRequestOptions) => request<T>(url, body, options),
    put: <T>(url: string, body?: unknown, options?: HttpRequestOptions) => request<T>(url, body, options),
    delete: <T>(url: string, options?: HttpRequestOptions) => request<T>(url, undefined, options),
    setResponse: <T>(response: HttpResponse<T>) => { nextResponse = response; },
    setError: (error: Error) => { nextError = error; },
    getLastRequest: () => lastRequest,
  };
};

describe('TransactionService Parity Tests', () => {
  let http: ReturnType<typeof createMockHttpClient>;
  let logger: MockLogger;
  let txService: TransactionService;

  const config: TransactionServiceConfig = {
    baseUrl: 'https://api.test.com',
    apiKey: 'test-api-key',
    paramSet: 'v2-spec',
  };

  const mockPrepareResponse = {
    txId: 'tx-123',
    leaseId: 'lease-456',
    leaseToken: 'token-789',
    addressIndex: 0,
    l1: 0,
    l2: 0,
    digestTx: '0'.repeat(64),
    leaseTTL: 60000,
    expiresAt: Date.now() + 60000,
  };

  beforeEach(() => {
    http = createMockHttpClient();
    logger = new MockLogger();
    txService = new TransactionService(http, config, logger);
  });

  afterEach(() => {
    logger.reset();
  });

  describe('Transaction Preparation', () => {
    test('prepare calls correct endpoint with params', async () => {
      http.setResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {},
        data: mockPrepareResponse,
      });

      await txService.prepare(
        { to: 'Mx12345', amount: '1000', tokenId: '0x00' },
        'root-pk-hex'
      );

      const lastReq = http.getLastRequest();
      expect(lastReq?.url).toBe('https://api.test.com/wots/hardened/prepare');
      expect(lastReq?.body).toMatchObject({
        rootPublicKey: 'root-pk-hex',
        to: 'Mx12345',
        amount: '1000',
      });
    });

    test('prepare returns lease information', async () => {
      http.setResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {},
        data: mockPrepareResponse,
      });

      const result = await txService.prepare(
        { to: 'Mx12345', amount: '1000' },
        'root-pk-hex'
      );

      expect(result.leaseId).toBe('lease-456');
      expect(result.addressIndex).toBe(0);
      expect(result.l1).toBe(0);
      expect(result.l2).toBe(0);
    });

    test('prepare includes API key header', async () => {
      http.setResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {},
        data: mockPrepareResponse,
      });

      await txService.prepare(
        { to: 'Mx12345', amount: '1000' },
        'root-pk-hex'
      );

      const lastReq = http.getLastRequest();
      expect(lastReq?.options?.headers?.['x-api-key']).toBe('test-api-key');
    });

    test('prepare logs request details', async () => {
      http.setResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {},
        data: mockPrepareResponse,
      });

      await txService.prepare(
        { to: 'Mx12345', amount: '1000' },
        'root-pk-hex'
      );

      expect(logger.logs.some(l => l.level === 'debug')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('prepare propagates network errors', async () => {
      http.setError(new Error('Network error'));

      await expect(
        txService.prepare({ to: 'Mx12345', amount: '1000' }, 'root-pk-hex')
      ).rejects.toThrow('Network error');
    });

    test('prepare logs errors', async () => {
      http.setError(new Error('Test error'));

      try {
        await txService.prepare({ to: 'Mx12345', amount: '1000' }, 'root-pk-hex');
      } catch {
      }

      expect(logger.logs.some(l => l.level === 'error')).toBe(true);
    });
  });

  describe('Signing', () => {
    const mockDeps: WotsSigningDependencies = {
      wotsSign: jest.fn().mockReturnValue(new Uint8Array(2144)),
      fromHex: jest.fn().mockReturnValue(new Uint8Array(32)),
      getParamSet: jest.fn().mockReturnValue({}),
      defaultParamSet: {},
    };

    const signRequest = {
      addressIndex: 0,
      l1: 0,
      l2: 0,
      digestTx: '0'.repeat(64),
    };

    test('sign calls WOTS signing for all levels', async () => {
      const seed = new Uint8Array(32);

      await txService.sign(signRequest, seed, mockDeps);

      expect(mockDeps.wotsSign).toHaveBeenCalledTimes(3);
    });

    test('sign returns witness bundle and signedHex', async () => {
      const seed = new Uint8Array(32);

      const result = await txService.sign(signRequest, seed, mockDeps);

      expect(result.witnessBundle).toBeDefined();
      expect(result.signedHex).toBeDefined();
    });

    test('sign validates digest length', async () => {
      const badDeps: WotsSigningDependencies = {
        ...mockDeps,
        fromHex: jest.fn().mockReturnValue(new Uint8Array(16)),
      };

      await expect(
        txService.sign(signRequest, new Uint8Array(32), badDeps)
      ).rejects.toThrow('Invalid digest length');
    });
  });

  describe('Finalization', () => {
    test('finalize calls correct endpoint', async () => {
      const finalizeResponse = {
        ok: true,
        leaseId: 'lease-456',
        txpowid: 'txpow-123',
      };

      http.setResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {},
        data: finalizeResponse,
      });

      await txService.finalize({
        leaseToken: 'token-789',
        signedHex: 'deadbeef',
      });

      const lastReq = http.getLastRequest();
      expect(lastReq?.url).toBe('https://api.test.com/wots/hardened/finalize');
    });

    test('finalize includes lease token and signed hex', async () => {
      http.setResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { ok: true, leaseId: 'lease-456', txpowid: 'txpow-123' },
      });

      await txService.finalize({
        leaseToken: 'token-789',
        signedHex: 'deadbeef',
      });

      const lastReq = http.getLastRequest();
      expect(lastReq?.body).toMatchObject({
        leaseToken: 'token-789',
        signedHex: 'deadbeef',
      });
    });
  });
});
