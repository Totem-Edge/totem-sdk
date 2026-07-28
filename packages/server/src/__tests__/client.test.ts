/**
 * Tests for MinimaClient (client.ts)
 *
 * Mocks node-fetch for HTTP calls and the `ws` WebSocket for the connect path.
 * Pure state/sync methods are tested without mocks.
 */
import { EventEmitter } from 'events';
import { MinimaClient } from '../client';

// ─── mock node-fetch ─────────────────────────────────────────────────────────
jest.mock('node-fetch', () => jest.fn());
import nodeFetch from 'node-fetch';
const mockFetch = nodeFetch as unknown as jest.Mock;

// ─── mock WebSocket ───────────────────────────────────────────────────────────
// Each instance auto-emits 'open' on the next microtask so connect() resolves.
// Set noAutoOpenNext = true before a test to suppress auto-open for that test.
let noAutoOpenNext = false;

class FakeWebSocket extends EventEmitter {
  static OPEN = 1;
  readyState = FakeWebSocket.OPEN;
  send = jest.fn();
  close = jest.fn().mockImplementation(function(this: FakeWebSocket) {
    this.readyState = 3;
    this.emit('close');
  });

  constructor(autoOpen: boolean) {
    super();
    if (autoOpen) {
      Promise.resolve().then(() => this.emit('open'));
    }
  }
}

let lastFakeWs: FakeWebSocket;
jest.mock('ws', () => {
  const WS = jest.fn().mockImplementation(() => {
    const auto = !noAutoOpenNext;
    noAutoOpenNext = false;
    lastFakeWs = new FakeWebSocket(auto);
    return lastFakeWs;
  });
  (WS as any).OPEN = 1;
  return WS;
});

// ─────────────────────────────────────────────────────────────────────────────

const API_URL = 'https://api.axia.to';
const API_KEY = 'ak_test';

function jsonResponse(body: unknown, ok = true) {
  return Promise.resolve({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

afterEach(() => {
  jest.clearAllMocks();
});

describe('MinimaClient — getBalance', () => {
  it('returns the total for the native token by default', async () => {
    mockFetch.mockResolvedValue(jsonResponse({
      entries: [
        { tokenid: '0x00', total: '42.5' },
        { tokenid: '0xFEED', total: '100' },
      ],
    }));
    const client = new MinimaClient({ apiUrl: API_URL, apiKey: API_KEY });
    const balance = await client.getBalance('MxABC');
    expect(balance).toBe('42.5');
  });

  it('returns the total for a specific tokenId', async () => {
    mockFetch.mockResolvedValue(jsonResponse({
      entries: [
        { tokenid: '0x00', total: '10' },
        { tokenid: '0xFEED', total: '250' },
      ],
    }));
    const client = new MinimaClient({ apiUrl: API_URL, apiKey: API_KEY });
    const balance = await client.getBalance('MxABC', '0xFEED');
    expect(balance).toBe('250');
  });

  it("returns '0' when no matching token entry", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ entries: [] }));
    const client = new MinimaClient({ apiUrl: API_URL, apiKey: API_KEY });
    expect(await client.getBalance('MxABC')).toBe('0');
  });

  it('GETs the correct portfolio endpoint with the x-api-key header', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ entries: [] }));
    const client = new MinimaClient({ apiUrl: API_URL, apiKey: API_KEY });
    await client.getBalance('MxABC');
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/v1/wallet/portfolio/');
    expect((opts.headers as Record<string, string>)['x-api-key']).toBe(API_KEY);
  });

  it('throws on HTTP error', async () => {
    mockFetch.mockResolvedValue(jsonResponse({}, false));
    const client = new MinimaClient({ apiUrl: API_URL, apiKey: API_KEY });
    await expect(client.getBalance('MxABC')).rejects.toThrow('HTTP 500');
  });
});

describe('MinimaClient — getUTXOs', () => {
  it('maps coinid + amount + tokenid correctly', async () => {
    mockFetch.mockResolvedValue(jsonResponse({
      utxos: [
        { coinid: '0xC1', address: 'MxABC', amount: '10', tokenid: '0xFEED' },
        { coinid: '0xC2', address: 'MxABC', amount: '5',  tokenid: '0x00' },
      ],
    }));
    const client = new MinimaClient({ apiUrl: API_URL, apiKey: API_KEY });
    const utxos = await client.getUTXOs('MxABC');
    expect(utxos).toHaveLength(2);
    expect(utxos[0]).toMatchObject({ id: '0xC1', amount: '10', tokenId: '0xFEED' });
    // native token entry should have tokenId: undefined
    expect(utxos[1].tokenId).toBeUndefined();
  });

  it('returns empty array when no utxos key', async () => {
    mockFetch.mockResolvedValue(jsonResponse({}));
    const client = new MinimaClient({ apiUrl: API_URL, apiKey: API_KEY });
    expect(await client.getUTXOs('MxABC')).toEqual([]);
  });

  it('GETs the correct UTXOs endpoint', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ utxos: [] }));
    const client = new MinimaClient({ apiUrl: API_URL, apiKey: API_KEY });
    await client.getUTXOs('MxABC');
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/v1/wallet/utxos/');
  });
});

describe('MinimaClient — getBlockHeight', () => {
  it('returns chain.block from RPC response', async () => {
    mockFetch.mockResolvedValue(jsonResponse({
      status: true,
      response: { chain: { block: 12345 } },
    }));
    const client = new MinimaClient({ apiUrl: API_URL, apiKey: API_KEY });
    expect(await client.getBlockHeight()).toBe(12345);
  });

  it('returns 0 when chain block is absent', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ status: true, response: {} }));
    const client = new MinimaClient({ apiUrl: API_URL, apiKey: API_KEY });
    expect(await client.getBlockHeight()).toBe(0);
  });

  it('POSTs the status command to /v1/wallet/rpc', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ status: true, response: {} }));
    const client = new MinimaClient({ apiUrl: API_URL, apiKey: API_KEY });
    await client.getBlockHeight();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/v1/wallet/rpc');
    expect(opts.body).toBe('status');
  });

  it('throws when RPC returns status:false', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ status: false }));
    const client = new MinimaClient({ apiUrl: API_URL, apiKey: API_KEY });
    await expect(client.getBlockHeight()).rejects.toThrow('status:false');
  });
});

describe('MinimaClient — buildTransaction', () => {
  it('always throws with helpful message', async () => {
    const client = new MinimaClient({ apiUrl: API_URL, apiKey: API_KEY });
    await expect(client.buildTransaction({ from: 'MxA', to: 'MxB', amount: '1' }))
      .rejects.toThrow('@totemsdk/tx-builder');
  });
});

describe('MinimaClient — subscribe', () => {
  it('throws if called before connect()', () => {
    const client = new MinimaClient({ apiUrl: API_URL, apiKey: API_KEY });
    expect(() => client.subscribe(['MxABC'])).toThrow('not connected');
  });
});

describe('MinimaClient — disconnect', () => {
  it('is a no-op when not connected', () => {
    const client = new MinimaClient({ apiUrl: API_URL, apiKey: API_KEY });
    expect(() => client.disconnect()).not.toThrow();
  });
});

describe('MinimaClient — connect() and WebSocket events', () => {
  function setupTokenFetch() {
    mockFetch.mockResolvedValue(jsonResponse({ token: 'jwt-abc' }));
  }

  it('fetches a JWT from ws-token and opens a WebSocket', async () => {
    setupTokenFetch();
    const client = new MinimaClient({ apiUrl: API_URL, apiKey: API_KEY });
    await client.connect(); // FakeWebSocket auto-emits 'open' on next microtask
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('ws-token'), expect.anything());
  });

  it('emits "connected" on WebSocket open', async () => {
    setupTokenFetch();
    const client = new MinimaClient({ apiUrl: API_URL, apiKey: API_KEY });
    const events: string[] = [];
    client.on('connected', () => events.push('connected'));
    await client.connect();
    expect(events).toContain('connected');
  });

  it('emits "balance" on portfolio_snapshot message', async () => {
    setupTokenFetch();
    const client = new MinimaClient({ apiUrl: API_URL, apiKey: API_KEY });
    const received: unknown[] = [];
    client.on('balance', e => received.push(e));
    await client.connect();
    lastFakeWs.emit('message', Buffer.from(JSON.stringify({
      type: 'portfolio_snapshot',
      entries: [{ tokenid: '0x00', total: '10' }],
    })));
    expect(received[0]).toEqual([{ tokenid: '0x00', total: '10' }]);
  });

  it('auto-responds to ping with pong', async () => {
    setupTokenFetch();
    const client = new MinimaClient({ apiUrl: API_URL, apiKey: API_KEY });
    await client.connect();
    lastFakeWs.emit('message', Buffer.from(JSON.stringify({ type: 'ping' })));
    expect(lastFakeWs.send).toHaveBeenCalledWith(JSON.stringify({ type: 'pong' }));
  });

  it('subscribe sends correct JSON over WebSocket', async () => {
    setupTokenFetch();
    const client = new MinimaClient({ apiUrl: API_URL, apiKey: API_KEY });
    await client.connect();
    client.subscribe(['MxABC', 'MxDEF']);
    expect(lastFakeWs.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'subscribe', filter: { addresses: ['MxABC', 'MxDEF'] } })
    );
  });

  it('rejects if WebSocket emits error before open', async () => {
    setupTokenFetch();
    noAutoOpenNext = true; // suppress auto-open so we can inject the error
    const client = new MinimaClient({ apiUrl: API_URL, apiKey: API_KEY });
    // Suppress the 'error' event that MinimaClient re-emits (Node throws if unhandled)
    client.on('error', () => {});
    const p = client.connect();
    // Two ticks: one for fetch() resolution, one for tokenRes.json() resolution
    await Promise.resolve();
    await Promise.resolve();
    lastFakeWs.emit('error', new Error('ECONNREFUSED'));
    await expect(p).rejects.toThrow('ECONNREFUSED');
  });

  it('disconnect closes the WebSocket', async () => {
    setupTokenFetch();
    const client = new MinimaClient({ apiUrl: API_URL, apiKey: API_KEY });
    await client.connect();
    client.disconnect();
    expect(lastFakeWs.close).toHaveBeenCalled();
  });
});
