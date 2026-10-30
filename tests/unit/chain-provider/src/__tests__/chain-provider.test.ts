import { HostedProvider } from '../providers/hosted';
import { CompositeProvider } from '../providers/composite';
import { LookupClientProvider } from '../providers/lookup-client';
import type { LookupClientLike } from '../providers/lookup-client';
import type { ChainStateProvider, ChainTip } from '../types';

function mockFetch(data: unknown, ok = true, status = 200) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(data),
  }) as unknown as typeof fetch;
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('HostedProvider', () => {
  const provider = new HostedProvider({ baseUrl: 'https://api.axia.to', apiKey: 'test-key' });

  // ── getCoins ─────────────────────────────────────────────────────────────

  it('getCoins uses path param for address on /v1/wallet/utxos/:address', async () => {
    mockFetch({ utxos: [] });
    await provider.getCoins({ address: 'Mx123' });
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('/v1/wallet/utxos/Mx123');
  });

  it('getCoins maps utxos array to Coin[]', async () => {
    mockFetch({ utxos: [{ coinid: '0xABC', amount: '1.5', address: 'Mx123', tokenid: '0x00' }] });
    const coins = await provider.getCoins({ address: 'Mx123' });
    expect(coins).toHaveLength(1);
    expect(coins[0].coinid).toBe('0xABC');
    expect(coins[0].amount).toBe('1.5');
    expect(coins[0].tokenid).toBe('0x00');
  });

  it('getCoins returns empty array when no address or coinId provided', async () => {
    const coins = await provider.getCoins({});
    expect(coins).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('getCoins filters by tokenId client-side', async () => {
    mockFetch({
      utxos: [
        { coinid: '0xA', amount: '1', address: 'Mx1', tokenid: '0x00' },
        { coinid: '0xB', amount: '2', address: 'Mx1', tokenid: '0xTOKEN' },
      ],
    });
    const coins = await provider.getCoins({ address: 'Mx1', tokenId: '0xTOKEN' });
    expect(coins).toHaveLength(1);
    expect(coins[0].coinid).toBe('0xB');
  });

  // ── getTip ───────────────────────────────────────────────────────────────

  it('getTip posts to /v1/wallet/rpc with "status" command', async () => {
    mockFetch({ status: true, response: { chain: { block: 100, hash: '0xHASH' } } });
    await provider.getTip();
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/v1/wallet/rpc');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('status');
  });

  it('getTip parses chain.block from RPC response envelope', async () => {
    mockFetch({ status: true, response: { chain: { block: 200, hash: '0xHASH2' } } });
    const tip = await provider.getTip();
    expect(tip.block).toBe(200);
    expect(tip.hash).toBe('0xHASH2');
  });

  it('getTip returns 0 when chain missing from RPC response', async () => {
    mockFetch({ status: true, response: null });
    const tip = await provider.getTip();
    expect(tip.block).toBe(0);
    expect(tip.hash).toBe('');
  });

  // ── broadcastTxPoW ───────────────────────────────────────────────────────

  it('broadcastTxPoW posts to /api/meg/postminedtxn', async () => {
    mockFetch({ txpowid: '0xTXID' });
    const result = await provider.broadcastTxPoW('0xDEAD');
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('/api/meg/postminedtxn');
    expect(result.success).toBe(true);
    expect(result.txpowid).toBe('0xTXID');
  });

  it('broadcastTxPoW returns success:false on network error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;
    const result = await provider.broadcastTxPoW('0xDEAD');
    expect(result.success).toBe(false);
    expect(result.message).toContain('network down');
  });

  it('broadcastTxPoW returns success:false on non-OK HTTP status', async () => {
    mockFetch({ error: 'bad request' }, false, 400);
    const result = await provider.broadcastTxPoW('0xDEAD');
    expect(result.success).toBe(false);
  });

  // ── auth header ──────────────────────────────────────────────────────────

  it('attaches x-api-key header on utxos requests', async () => {
    mockFetch({ utxos: [] });
    await provider.getCoins({ address: 'Mx1' });
    const headers = (global.fetch as jest.Mock).mock.calls[0][1].headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('test-key');
  });

  it('attaches x-api-key header on RPC requests', async () => {
    mockFetch({ status: true, response: { chain: { block: 1, hash: '0x' } } });
    await provider.getTip();
    const headers = (global.fetch as jest.Mock).mock.calls[0][1].headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('test-key');
  });
});

describe('CompositeProvider', () => {
  function makeProvider(tip: ChainTip, shouldFail = false): ChainStateProvider {
    return {
      getCoins: jest.fn().mockResolvedValue([]),
      getCoin: jest.fn().mockResolvedValue(null),
      getProof: jest.fn().mockResolvedValue({}),
      getTip: shouldFail
        ? jest.fn().mockRejectedValue(new Error('primary down'))
        : jest.fn().mockResolvedValue(tip),
      getToken: jest.fn().mockResolvedValue({}),
      searchTokens: jest.fn().mockResolvedValue([]),
      getTokensByCreator: jest.fn().mockResolvedValue([]),
      broadcastTxPoW: jest.fn().mockResolvedValue({ success: true }),
    };
  }

  it('uses primary when it succeeds', async () => {
    const primary = makeProvider({ block: 10, hash: '0xA' });
    const fallback = makeProvider({ block: 5, hash: '0xB' });
    const composite = new CompositeProvider(primary, fallback);
    const tip = await composite.getTip();
    expect(tip.block).toBe(10);
    expect(fallback.getTip).not.toHaveBeenCalled();
  });

  it('falls back to secondary when primary fails', async () => {
    const primary = makeProvider({ block: 10, hash: '0xA' }, true);
    const fallback = makeProvider({ block: 5, hash: '0xB' });
    const composite = new CompositeProvider(primary, fallback);
    const tip = await composite.getTip();
    expect(tip.block).toBe(5);
  });

  it('calls onFallback callback when falling back', async () => {
    const onFallback = jest.fn();
    const primary = makeProvider({ block: 10, hash: '0xA' }, true);
    const fallback = makeProvider({ block: 5, hash: '0xB' });
    const composite = new CompositeProvider(primary, fallback, onFallback);
    await composite.getTip();
    expect(onFallback).toHaveBeenCalledWith('getTip', expect.any(Error));
  });
});

describe('LookupClientProvider', () => {
  function makeMockClient(): LookupClientLike {
    return {
      getCoins: jest.fn().mockResolvedValue([{ coinid: '0xC01N' }]),
      getCoin: jest.fn().mockResolvedValue({ coinid: '0xC01N' }),
      getProof: jest.fn().mockResolvedValue({ coinid: '0xC01N', data: {} }),
      getTip: jest.fn().mockResolvedValue({ block: 42, hash: '0xTIP' }),
      getToken: jest.fn().mockResolvedValue({ tokenid: '0x00', name: {} }),
      searchTokens: jest.fn().mockResolvedValue([]),
      getTokensByCreator: jest.fn().mockResolvedValue([]),
      broadcastTxPoW: jest.fn().mockResolvedValue({ success: true, txpowid: '0xTX' }),
    };
  }

  it('delegates getTip to the underlying client', async () => {
    const client = makeMockClient();
    const provider = new LookupClientProvider(client);
    const tip = await provider.getTip();
    expect(tip.block).toBe(42);
    expect(client.getTip).toHaveBeenCalledTimes(1);
  });

  it('delegates getCoins with query to the underlying client', async () => {
    const client = makeMockClient();
    const provider = new LookupClientProvider(client);
    const coins = await provider.getCoins({ address: 'Mx123' });
    expect(coins[0].coinid).toBe('0xC01N');
    expect(client.getCoins).toHaveBeenCalledWith({ address: 'Mx123' });
  });

  it('delegates getCoin to the underlying client', async () => {
    const client = makeMockClient();
    const provider = new LookupClientProvider(client);
    const coin = await provider.getCoin('0xC01N');
    expect(coin).not.toBeNull();
    expect(client.getCoin).toHaveBeenCalledWith('0xC01N');
  });

  it('delegates getProof to the underlying client', async () => {
    const client = makeMockClient();
    const provider = new LookupClientProvider(client);
    const proof = await provider.getProof('0xC01N');
    expect(proof.coinid).toBe('0xC01N');
    expect(client.getProof).toHaveBeenCalledWith('0xC01N');
  });

  it('delegates getToken to the underlying client', async () => {
    const client = makeMockClient();
    const provider = new LookupClientProvider(client);
    const token = await provider.getToken('0x00');
    expect(token.tokenid).toBe('0x00');
    expect(client.getToken).toHaveBeenCalledWith('0x00');
  });

  it('delegates searchTokens to the underlying client', async () => {
    const client = makeMockClient();
    const provider = new LookupClientProvider(client);
    const tokens = await provider.searchTokens({ name: 'foo' });
    expect(tokens).toEqual([]);
    expect(client.searchTokens).toHaveBeenCalledWith({ name: 'foo' });
  });

  it('delegates getTokensByCreator to the underlying client', async () => {
    const client = makeMockClient();
    const provider = new LookupClientProvider(client);
    const tokens = await provider.getTokensByCreator('Mx...');
    expect(tokens).toEqual([]);
    expect(client.getTokensByCreator).toHaveBeenCalledWith('Mx...');
  });

  it('delegates broadcastTxPoW to the underlying client', async () => {
    const client = makeMockClient();
    const provider = new LookupClientProvider(client);
    const result = await provider.broadcastTxPoW('0xDEAD');
    expect(result.success).toBe(true);
    expect(result.txpowid).toBe('0xTX');
    expect(client.broadcastTxPoW).toHaveBeenCalledWith('0xDEAD');
  });

  it('works inside a CompositeProvider as the primary provider', async () => {
    const client = makeMockClient();
    const lookup = new LookupClientProvider(client);
    const fallback: ChainStateProvider = {
      getCoins: jest.fn().mockResolvedValue([]),
      getCoin: jest.fn().mockResolvedValue(null),
      getProof: jest.fn().mockResolvedValue({}),
      getTip: jest.fn().mockResolvedValue({ block: 1, hash: '0xFB' }),
      getToken: jest.fn().mockResolvedValue({}),
      searchTokens: jest.fn().mockResolvedValue([]),
      getTokensByCreator: jest.fn().mockResolvedValue([]),
      broadcastTxPoW: jest.fn().mockResolvedValue({ success: false }),
    };
    const composite = new CompositeProvider(lookup, fallback);
    const tip = await composite.getTip();
    expect(tip.block).toBe(42);
    expect(fallback.getTip).not.toHaveBeenCalled();
  });
});
