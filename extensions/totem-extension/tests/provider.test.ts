/**
 * Jest unit tests for Totem provider (rpcCall).
 * - Mocks fetch
 * - Mocks timers and Math.random for deterministic jitter
 * - Verifies Retry-After handling (429) and 5xx retries
 * - Verifies X-Idempotency-Key header for writes
 */
import { rpcCall } from '../src/rpc/enhanced-provider';

// Basic Headers mock with case-insensitive get/has
class Hdrs {
  private h: Record<string, string>;
  constructor(h: Record<string, string> = {}) { 
    this.h = {}; 
    for (const k in h) this.h[k.toLowerCase()] = h[k]; 
  }
  get(k: string) { return this.h[k.toLowerCase()] ?? null; }
  has(k: string) { return this.get(k) !== null; }
}

function makeJsonRes(status: number, headers: Record<string,string>, body: any) {
  return {
    status,
    headers: new Hdrs(headers),
    async json() { return body; },
    async text() { return JSON.stringify(body); }
  } as any;
}

function makeTextRes(status: number, headers: Record<string,string>, text: string) {
  return {
    status,
    headers: new Hdrs(headers),
    async json() { throw new Error('no json'); },
    async text() { return text; }
  } as any;
}

describe('rpcCall', () => {
  const realFetch = global.fetch as any;
  const fetchMock = jest.fn();

  beforeAll(() => {
    (global as any).fetch = fetchMock;
  });

  afterAll(() => {
    (global as any).fetch = realFetch;
  });

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(global.Math, 'random').mockReturnValue(0); // deterministic jitter -> base backoff
    fetchMock.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
    (Math.random as any).mockRestore();
  });

  test('success 200 on first attempt', async () => {
    fetchMock.mockResolvedValueOnce(makeJsonRes(200, {
      'X-RateLimit-Limit': '1200',
      'X-RateLimit-Remaining': '1199',
      'X-RateLimit-Reset': String(Math.floor(Date.now()/1000)+60)
    }, { jsonrpc: '2.0', id: 1, result: '0xabc' }));

    const res = await rpcCall('totem-shared', 'balance/tokens', ['0x123']);
    expect(res.result).toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://rpc.axia.to/v1/totem-shared');
    expect(init.method).toBe('POST');
  });

  test('backs off using Retry-After on 429 then succeeds', async () => {
    fetchMock
      .mockResolvedValueOnce(makeJsonRes(429, {
        'Retry-After': '1',
        'X-RateLimit-Limit': '1200',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.floor(Date.now()/1000)+1)
      }, { jsonrpc: '2.0', id: 1, error: { code: 429, message: 'Rate limit exceeded', data: { axia: { code: 42901 }, retryAfter: 1 }}}))
      .mockResolvedValueOnce(makeJsonRes(200, {}, { jsonrpc: '2.0', id: 1, result: 'ok' }));

    const p = rpcCall('totem-shared', 'balance/tokens', ['0x123']);
    // advance Retry-After
    await jest.advanceTimersByTimeAsync(1000);
    const res = await p;
    expect(res.result).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('retries 5xx with jitter and uses X-Idempotency-Key for writes', async () => {
    // Sequence: 502 -> 502 -> 200
    fetchMock
      .mockResolvedValueOnce(makeTextRes(502, {}, 'bad gateway'))
      .mockResolvedValueOnce(makeTextRes(502, {}, 'bad gateway'))
      .mockResolvedValueOnce(makeJsonRes(200, {}, { jsonrpc: '2.0', id: 42, result: 'sent' }));

    const rawTx = '0xabc123';
    const p = rpcCall('totem-shared', 'tx/submit', [rawTx], { maxAttempts: 3 });

    // attempt 1 backoff (Math.random=0 => 400ms)
    await jest.advanceTimersByTimeAsync(400);
    // attempt 2 backoff (800ms)
    await jest.advanceTimersByTimeAsync(800);

    const res = await p;
    expect(res.result).toBe('sent');
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // Check header present and consistent
    const h1 = fetchMock.mock.calls[0][1].headers['X-Idempotency-Key'];
    const h2 = fetchMock.mock.calls[1][1].headers['X-Idempotency-Key'];
    const h3 = fetchMock.mock.calls[2][1].headers['X-Idempotency-Key'];
    expect(h1).toBeDefined();
    expect(h1).toEqual(h2);
    expect(h2).toEqual(h3);
    expect(h1).toMatch(/^0x[a-f0-9]{64}$/); // Valid SHA3-256 hex
  });

  test('does not retry non-429 4xx and throws', async () => {
    fetchMock.mockResolvedValueOnce(makeTextRes(404, {}, 'not found'));
    await expect(rpcCall('totem-shared', 'balance/tokens', ['0x0']))
      .rejects.toThrow(/HTTP 404/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('handles timeout with AbortController', async () => {
    fetchMock.mockRejectedValueOnce(Object.assign(new Error('timeout'), { name: 'AbortError' }));
    
    await expect(rpcCall('totem-shared', 'status', [], { maxAttempts: 1 }))
      .rejects.toThrow(/timeout/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('includes correct headers for write operations', async () => {
    fetchMock.mockResolvedValueOnce(makeJsonRes(200, {}, { jsonrpc: '2.0', id: 1, result: 'txid' }));

    await rpcCall('totem-shared', 'tx/build', ['param1']);
    
    const [url, init] = fetchMock.mock.calls[0];
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers['User-Agent']).toBe('Totem/1.0');
    expect(init.headers['X-Idempotency-Key']).toMatch(/^0x[a-f0-9]{64}$/);
  });

  test('includes correct headers for read operations', async () => {
    fetchMock.mockResolvedValueOnce(makeJsonRes(200, {}, { jsonrpc: '2.0', id: 1, result: {} }));

    await rpcCall('totem-shared', 'balance/tokens', ['0x123']);
    
    const [url, init] = fetchMock.mock.calls[0];
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers['User-Agent']).toBe('Totem/1.0');
    expect(init.headers['X-Idempotency-Key']).toBeUndefined(); // No idempotency key for reads
  });

  test('respects maxAttempts configuration', async () => {
    fetchMock
      .mockResolvedValueOnce(makeTextRes(502, {}, 'error'))
      .mockResolvedValueOnce(makeTextRes(502, {}, 'error'));

    await expect(rpcCall('totem-shared', 'status', [], { maxAttempts: 2 }))
      .rejects.toThrow(/Gateway error 502 after 2 attempts/);
    
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});