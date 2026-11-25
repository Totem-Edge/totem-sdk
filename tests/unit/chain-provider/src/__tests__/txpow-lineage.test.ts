import { CompositeProvider } from '../providers/composite';
import { HostedProvider } from '../providers/hosted';
import { MinimaRpcProvider } from '../providers/minima-rpc';
import { extractTxPowCoinIds, extractTxPowOutputs } from '../txpow';
import type { ChainStateProvider, Coin, ChainTip } from '../types';

/**
 * Splice lineage from the node's own `txpow` command.
 *
 * Minima derives an output coin id from the first input's coin id and the output
 * index, so a coin the splice created cannot be predicted from the draft. The
 * node already answers which outputs a TxPoW created — these tests pin the
 * parsing and the provider wiring, because a silent `[]` here would look like
 * "the splice created nothing" and a silent `null` handling bug would look like
 * "unknown" forever.
 */

const COIN_A = '0x' + 'aa'.repeat(32);
const COIN_B = '0x' + 'bb'.repeat(32);

const nodeBody = {
  header: { block: 1234 },
  body: {
    inputs: [{ coinid: '0x' + '11'.repeat(32) }],
    outputs: [
      { coinid: COIN_A, address: 'MxAAA', tokenid: '0x00', amount: '10' },
      { coinid: COIN_B, address: 'MxBBB', tokenid: '0x00', amount: '5', spent: false },
    ],
    state: [],
  },
};

describe('extractTxPowOutputs', () => {
  test('reads a bare TxPoW body', () => {
    expect(extractTxPowCoinIds(nodeBody)).toEqual([COIN_A, COIN_B]);
  });

  test('reads a body wrapped in txpow or response', () => {
    expect(extractTxPowCoinIds({ txpow: nodeBody })).toEqual([COIN_A, COIN_B]);
    expect(extractTxPowCoinIds({ status: true, response: nodeBody })).toEqual([COIN_A, COIN_B]);
    expect(extractTxPowCoinIds({ response: { txpow: nodeBody } })).toEqual([COIN_A, COIN_B]);
  });

  test('accepts the archive service coin_id spelling', () => {
    const archive = { outputs: [{ coin_id: COIN_A }, { coin_id: COIN_B }] };
    expect(extractTxPowCoinIds(archive)).toEqual([COIN_A, COIN_B]);
  });

  test('keeps descriptive output fields', () => {
    expect(extractTxPowOutputs(nodeBody)?.[0]).toMatchObject({
      coinId: COIN_A,
      address: 'MxAAA',
      tokenId: '0x00',
      amount: '10',
    });
  });

  test('returns null rather than an empty list when it cannot interpret', () => {
    expect(extractTxPowCoinIds(undefined)).toBeNull();
    expect(extractTxPowCoinIds({ status: false, error: 'txpow not found' })).toBeNull();
    expect(extractTxPowCoinIds({ body: {} })).toBeNull();
  });

  test('drops outputs without a coin id instead of inventing one', () => {
    expect(extractTxPowCoinIds({ body: { outputs: [{ address: 'MxAAA' }, { coinid: COIN_A }] } }))
      .toEqual([COIN_A]);
  });
});

describe('MinimaRpcProvider.getTransactionOutputs', () => {
  test('asks the node for the txpow and returns its coin ids', async () => {
    const runCommand = jest.fn(async () => nodeBody);
    const provider = new MinimaRpcProvider({ runCommand } as never);

    await expect(provider.getTransactionOutputs('0xfeed')).resolves.toEqual([COIN_A, COIN_B]);
    expect(runCommand).toHaveBeenCalledWith('txpow', { txpowid: '0xfeed' });
  });

  test('returns null when the node cannot answer', async () => {
    const provider = new MinimaRpcProvider({
      runCommand: jest.fn(async () => {
        throw new Error('txpow not found');
      }),
    } as never);

    await expect(provider.getTransactionOutputs('0xfeed')).resolves.toBeNull();
  });
});

describe('HostedProvider.getTransactionOutputs', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('uses the hosted node RPC command', async () => {
    const calls: string[] = [];
    globalThis.fetch = jest.fn(async (_url: string, init?: RequestInit) => {
      calls.push(String(init?.body));
      return {
        ok: true,
        json: async () => ({ status: true, response: nodeBody }),
      } as unknown as Response;
    }) as unknown as typeof fetch;

    const provider = new HostedProvider({ baseUrl: 'https://api.example', apiKey: 'k' });
    await expect(provider.getTransactionOutputs('0xfeed')).resolves.toEqual([COIN_A, COIN_B]);
    expect(calls[0]).toBe('txpow txpowid:0xfeed');
  });

  test('returns null when the hosted node rejects the command', async () => {
    globalThis.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ status: false, error: 'not found' }),
    } as unknown as Response)) as unknown as typeof fetch;

    const provider = new HostedProvider({ baseUrl: 'https://api.example', apiKey: 'k' });
    await expect(provider.getTransactionOutputs('0xfeed')).resolves.toBeNull();
  });
});

describe('CompositeProvider.getTransactionOutputs', () => {
  test('falls back to the secondary provider', async () => {
    const primary = {
      getTransactionOutputs: async () => {
        throw new Error('primary offline');
      },
    } as unknown as ChainStateProvider;
    const fallback = {
      getTransactionOutputs: async () => [COIN_A],
    } as unknown as ChainStateProvider;

    const provider = new CompositeProvider(primary, fallback);
    await expect(provider.getTransactionOutputs('0xfeed')).resolves.toEqual([COIN_A]);
  });

  test('reports unknown, not "no outputs", when neither side can answer', async () => {
    const empty = {
      getCoins: async () => [] as Coin[],
      getTip: async () => ({ block: 1, hash: '0x0' }) as ChainTip,
    } as unknown as ChainStateProvider;
    const provider = new CompositeProvider(empty, empty);

    // null means "cannot tell"; an empty array would mean "created nothing",
    // which would let an unverified successor be adopted.
    await expect(provider.getTransactionOutputs('0xfeed')).resolves.toBeNull();
  });

  test('falls through to the fallback when the primary cannot tell', async () => {
    const primary = {
      getTransactionOutputs: async () => null,
    } as unknown as ChainStateProvider;
    const fallback = {
      getTransactionOutputs: async () => [COIN_A],
    } as unknown as ChainStateProvider;

    const provider = new CompositeProvider(primary, fallback);
    await expect(provider.getTransactionOutputs('0xfeed')).resolves.toEqual([COIN_A]);
  });
});
