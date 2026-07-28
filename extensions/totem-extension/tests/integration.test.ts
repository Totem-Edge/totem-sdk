/**
 * Integration tests using Postman Mock Server
 * Tests client retry logic against controlled mock responses
 */
import { rpcCall } from '../src/rpc/enhanced-provider';

// Override global fetch for testing
const originalFetch = global.fetch;

describe('Enhanced Provider Integration Tests', () => {
  const mockBaseUrl = process.env.MOCK_BASE_URL || 'https://test-mock.mock.pstmn.io';
  
  beforeAll(() => {
    // Mock fetch to use our test mock server
    (global as any).fetch = jest.fn().mockImplementation(async (url: string, options: any) => {
      // Replace the base URL with our mock server
      const mockUrl = url.replace('https://rpc.axia.to', mockBaseUrl);
      return originalFetch(mockUrl, options);
    });
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Mock Server Response Validation', () => {
    test('handles 200 OK response with rate limit headers', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      
      // Mock 200 OK response
      mockFetch.mockResolvedValueOnce({
        status: 200,
        headers: new Map([
          ['X-RateLimit-Limit', '1200'],
          ['X-RateLimit-Remaining', '1199'],
          ['X-RateLimit-Reset', '1730000000'],
          ['X-Project-Id', 'totem-shared'],
          ['Via', 'axia-edge']
        ]),
        json: async () => ({
          jsonrpc: '2.0',
          id: 1,
          result: { tokens: [{ tokenid: '0x00', name: 'Minima', amount: '100.5', decimals: 8 }] }
        })
      } as any);

      const response = await rpcCall('totem-shared', 'balance/tokens', ['0x123']);
      
      expect(response.result).toBeDefined();
      expect(response.result.tokens).toBeInstanceOf(Array);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    test('handles 429 rate limit with proper backoff', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      
      // Mock 429 then 200 responses
      mockFetch
        .mockResolvedValueOnce({
          status: 429,
          headers: new Map([
            ['Retry-After', '1'],
            ['X-RateLimit-Limit', '1200'],
            ['X-RateLimit-Remaining', '0'],
            ['X-RateLimit-Reset', '1730000002']
          ]),
          json: async () => ({
            jsonrpc: '2.0',
            id: 1,
            error: { code: 429, message: 'Rate limit exceeded', data: { retryAfter: 1 } }
          })
        } as any)
        .mockResolvedValueOnce({
          status: 200,
          headers: new Map([]),
          json: async () => ({ jsonrpc: '2.0', id: 1, result: 'success' })
        } as any);

      // Use fake timers to control backoff
      jest.useFakeTimers();
      
      const responsePromise = rpcCall('totem-shared', 'balance/tokens', ['0x123']);
      
      // Advance timer to trigger retry
      await jest.advanceTimersByTimeAsync(1000);
      
      const response = await responsePromise;
      
      expect(response.result).toBe('success');
      expect(mockFetch).toHaveBeenCalledTimes(2);
      
      jest.useRealTimers();
    });

    test('handles 502 errors with exponential backoff', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      
      // Mock 502 -> 502 -> 200 sequence
      mockFetch
        .mockResolvedValueOnce({
          status: 502,
          headers: new Map([['Via', 'axia-edge']]),
          text: async () => 'Bad Gateway'
        } as any)
        .mockResolvedValueOnce({
          status: 502,
          headers: new Map([['Via', 'axia-edge']]),
          text: async () => 'Bad Gateway'
        } as any)
        .mockResolvedValueOnce({
          status: 200,
          headers: new Map([]),
          json: async () => ({ jsonrpc: '2.0', id: 1, result: 'recovered' })
        } as any);

      jest.useFakeTimers();
      
      const responsePromise = rpcCall('totem-shared', 'balance/tokens', ['0x123'], { maxAttempts: 3 });
      
      // Advance timers for exponential backoff
      await jest.advanceTimersByTimeAsync(400); // First retry
      await jest.advanceTimersByTimeAsync(800); // Second retry
      
      const response = await responsePromise;
      
      expect(response.result).toBe('recovered');
      expect(mockFetch).toHaveBeenCalledTimes(3);
      
      jest.useRealTimers();
    });

    test('includes idempotency key for write operations', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      
      mockFetch.mockResolvedValueOnce({
        status: 200,
        headers: new Map([]),
        json: async () => ({ jsonrpc: '2.0', id: 42, result: '0xaccepted123456' })
      } as any);

      await rpcCall('totem-shared', 'tx/submit', ['0xdeadbeef']);
      
      const callArgs = mockFetch.mock.calls[0];
      const headers = callArgs[1].headers;
      
      expect(headers['X-Idempotency-Key']).toBeDefined();
      expect(headers['X-Idempotency-Key']).toMatch(/^0x[a-f0-9]{64}$/);
      expect(headers['User-Agent']).toBe('Totem/1.0');
    });

    test('maintains idempotency key consistency across retries', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      
      // Mock 502 -> 200 for retry scenario
      mockFetch
        .mockResolvedValueOnce({
          status: 502,
          headers: new Map([]),
          text: async () => 'Bad Gateway'
        } as any)
        .mockResolvedValueOnce({
          status: 200,
          headers: new Map([]),
          json: async () => ({ jsonrpc: '2.0', id: 42, result: '0xsuccess' })
        } as any);

      jest.useFakeTimers();
      
      const responsePromise = rpcCall('totem-shared', 'tx/build', ['param1'], { maxAttempts: 2 });
      
      // Advance timer for retry
      await jest.advanceTimersByTimeAsync(400);
      
      await responsePromise;
      
      // Verify idempotency key is the same across retries
      const firstCallHeaders = mockFetch.mock.calls[0][1].headers;
      const secondCallHeaders = mockFetch.mock.calls[1][1].headers;
      
      expect(firstCallHeaders['X-Idempotency-Key']).toBeDefined();
      expect(secondCallHeaders['X-Idempotency-Key']).toBeDefined();
      expect(firstCallHeaders['X-Idempotency-Key']).toBe(secondCallHeaders['X-Idempotency-Key']);
      
      jest.useRealTimers();
    });
  });

  describe('Error Handling', () => {
    test('throws on non-retryable 4xx errors', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      
      mockFetch.mockResolvedValueOnce({
        status: 404,
        headers: new Map([]),
        text: async () => 'Not Found'
      } as any);

      await expect(rpcCall('totem-shared', 'balance/tokens', ['0x123']))
        .rejects.toThrow(/HTTP 404/);
      
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    test('respects maxAttempts limit', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
      
      // Always return 502
      mockFetch.mockResolvedValue({
        status: 502,
        headers: new Map([]),
        text: async () => 'Bad Gateway'
      } as any);

      jest.useFakeTimers();
      
      const responsePromise = rpcCall('totem-shared', 'status', [], { maxAttempts: 2 });
      
      // Advance timer for retry
      await jest.advanceTimersByTimeAsync(400);
      
      await expect(responsePromise).rejects.toThrow(/Gateway error 502 after 2 attempts/);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      
      jest.useRealTimers();
    });
  });
});