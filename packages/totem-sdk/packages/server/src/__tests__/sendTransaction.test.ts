/**
 * Tests for sendTransaction.ts
 *
 * All network calls (node-fetch), mining (@totemsdk/txpow), and slow crypto
 * (@totemsdk/core tree key generation) are mocked so tests run in <1 second.
 */
import * as core from '@totemsdk/core';
import { sendTransaction, type SendParams } from '../sendTransaction';

// ─── mock node-fetch ─────────────────────────────────────────────────────────
jest.mock('node-fetch', () => jest.fn());
import nodeFetch from 'node-fetch';
const mockFetch = nodeFetch as unknown as jest.Mock;

// ─── mock @totemsdk/txpow ────────────────────────────────────────────────────
jest.mock('@totemsdk/txpow', () => ({
  fetchTxPowTarget: jest.fn(),
  serializeTxBody: jest.fn(),
  mineTxPoW: jest.fn(),
}));
import * as txpow from '@totemsdk/txpow';
const mockFetchTarget = txpow.fetchTxPowTarget as jest.Mock;
const mockSerializeTxBody = txpow.serializeTxBody as jest.Mock;
const mockMineTxPoW = txpow.mineTxPoW as jest.Mock;

// ─── fixtures ─────────────────────────────────────────────────────────────────

const SEED = 'ABLE ABLE ABLE ABLE ABLE ABLE ABLE ABLE ABLE ABLE ABLE ABLE ABLE ABLE ABLE ABLE ABLE ABLE ABLE ABLE ABLE ABLE ABLE ABLE';
const BASE_URL = 'https://api.axia.to';
const API_KEY = 'ak_test_key';

const FAKE_DIFFICULTY = new Uint8Array(32).fill(0xff);
const FAKE_TX_BODY = new Uint8Array([0x01, 0x02, 0x03]);
const FAKE_MINED_HEADER = new Uint8Array([0xaa, 0xbb]);

// Valid 32-byte hex coin IDs (not Mx-format, so addressToBytes won't call mxToHex)
const COIN_ID_1 = '0x' + 'abcdef01'.repeat(8);  // 64 hex chars = 32 bytes
const COIN_ID_2 = '0x' + 'deadbeef'.repeat(8);

// A plain hex toAddress (no Mx prefix) so mxToHex is never called
const TO_ADDRESS_HEX = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789ab';

const coins = [
  { coinId: COIN_ID_1, address: TO_ADDRESS_HEX, amount: '20', tokenId: '0x00', created: '100', mmrEntry: '5', storeState: false },
];
const proofs = [{ coinId: COIN_ID_1, coinProofHex: 'aabbccdd' }];
const TXPOW_ID = '0x' + 'ef'.repeat(32);

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeFetchSequence(responses: Array<{ ok: boolean; json?: unknown; text?: string }>) {
  let call = 0;
  mockFetch.mockImplementation(() => {
    const r = responses[call++] ?? { ok: false, text: 'unexpected call' };
    return Promise.resolve({
      ok: r.ok,
      status: r.ok ? 200 : 500,
      json: () => Promise.resolve(r.json),
      text: () => Promise.resolve(r.text ?? JSON.stringify(r.json)),
    });
  });
}

function stubSlowCrypto() {
  // deriveUnifiedAddressPublicKey + createUnifiedChildTreeKey each take ~3-14s.
  // Return a 32-byte array that scriptFromWotsPk and the tree key code will accept.
  const fakePubkey = new Uint8Array(32).fill(0x01);
  const mockTreeKey = { setUses: jest.fn(), sign: jest.fn().mockReturnValue({}) };
  jest.spyOn(core, 'deriveUnifiedAddressPublicKey').mockReturnValue(fakePubkey);
  jest.spyOn(core, 'createUnifiedChildTreeKey').mockReturnValue(mockTreeKey as any);
  jest.spyOn(core, 'serializeTreeSignature').mockReturnValue(new Uint8Array([0xaa, 0xbb, 0xcc]));
  return { mockTreeKey };
}

function setupHappyPath() {
  stubSlowCrypto();
  makeFetchSequence([
    { ok: true, json: { ok: true, coins } },
    { ok: true, json: { ok: true, proofs } },
    { ok: true, json: { ok: true, txpowId: TXPOW_ID } },
  ]);
  mockFetchTarget.mockResolvedValue(FAKE_DIFFICULTY);
  mockSerializeTxBody.mockReturnValue(FAKE_TX_BODY);
  mockMineTxPoW.mockResolvedValue({
    minedHeaderBytes: FAKE_MINED_HEADER,
    txpowId: new Uint8Array(32).fill(0x01),
    source: 'wasm' as const,
    elapsedMs: 42,
  });
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks(); // clear mock.calls so each test starts with index 0
});

const baseParams: SendParams = {
  seed: SEED,
  addressIndex: 0,
  toAddress: TO_ADDRESS_HEX,
  amount: '10',
  axiaBaseUrl: BASE_URL,
  apiKey: API_KEY,
  signingIndices: { l1: 0, l2: 0 },
};

// ─── tests ────────────────────────────────────────────────────────────────────

describe('sendTransaction — input validation', () => {
  it('throws on amount=0', async () => {
    await expect(sendTransaction({ ...baseParams, amount: '0' })).rejects.toThrow('Invalid amount');
  });

  it('throws on negative amount', async () => {
    await expect(sendTransaction({ ...baseParams, amount: '-5' })).rejects.toThrow('Invalid amount');
  });

  it('throws on non-numeric amount', async () => {
    await expect(sendTransaction({ ...baseParams, amount: 'abc' })).rejects.toThrow('Invalid amount');
  });

  it('throws when l1 is out of range', async () => {
    await expect(sendTransaction({ ...baseParams, signingIndices: { l1: 64, l2: 0 } })).rejects.toThrow('signingIndices');
  });

  it('throws when l2 is out of range', async () => {
    await expect(sendTransaction({ ...baseParams, signingIndices: { l1: 0, l2: 64 } })).rejects.toThrow('signingIndices');
  });
});

describe('sendTransaction — API error propagation', () => {
  beforeEach(() => stubSlowCrypto());

  it('throws when coins API returns HTTP error', async () => {
    makeFetchSequence([{ ok: false, text: 'unauthorized' }]);
    mockFetchTarget.mockResolvedValue(FAKE_DIFFICULTY);
    await expect(sendTransaction(baseParams)).rejects.toThrow(/HTTP 500/);
  });

  it('throws when coins API returns ok:false', async () => {
    makeFetchSequence([{ ok: true, json: { ok: false, error: 'address not indexed' } }]);
    mockFetchTarget.mockResolvedValue(FAKE_DIFFICULTY);
    await expect(sendTransaction(baseParams)).rejects.toThrow('address not indexed');
  });

  it('throws when coin list is empty', async () => {
    makeFetchSequence([{ ok: true, json: { ok: true, coins: [] } }]);
    mockFetchTarget.mockResolvedValue(FAKE_DIFFICULTY);
    await expect(sendTransaction(baseParams)).rejects.toThrow('No spendable');
  });

  it('throws when balance is insufficient', async () => {
    const tinyCoins = [{ ...coins[0], amount: '1' }];
    makeFetchSequence([{ ok: true, json: { ok: true, coins: tinyCoins } }]);
    mockFetchTarget.mockResolvedValue(FAKE_DIFFICULTY);
    await expect(sendTransaction({ ...baseParams, amount: '10' })).rejects.toThrow('Insufficient balance');
  });

  it('throws when proofs API returns HTTP error', async () => {
    makeFetchSequence([
      { ok: true, json: { ok: true, coins } },
      { ok: false, text: 'server error' },
    ]);
    mockFetchTarget.mockResolvedValue(FAKE_DIFFICULTY);
    await expect(sendTransaction(baseParams)).rejects.toThrow(/HTTP 500/);
  });

  it('throws when submit API fails', async () => {
    makeFetchSequence([
      { ok: true, json: { ok: true, coins } },
      { ok: true, json: { ok: true, proofs } },
      { ok: false, text: 'gateway timeout' },
    ]);
    mockFetchTarget.mockResolvedValue(FAKE_DIFFICULTY);
    mockSerializeTxBody.mockReturnValue(FAKE_TX_BODY);
    mockMineTxPoW.mockResolvedValue({ minedHeaderBytes: FAKE_MINED_HEADER, txpowId: new Uint8Array(32), source: 'wasm' as const, elapsedMs: 10 });
    await expect(sendTransaction(baseParams)).rejects.toThrow(/HTTP 500/);
  });
});

describe('sendTransaction — happy path', () => {
  it('returns txpowId, status:submitted, miningSource, and elapsedMs', async () => {
    setupHappyPath();
    const result = await sendTransaction(baseParams);
    expect(result.status).toBe('submitted');
    expect(result.txpowId).toBe(TXPOW_ID);
    expect(result.miningSource).toBe('wasm');
    expect(result.elapsedMs).toBe(42);
  });

  it('GETs coins from /v1/wallet/sdk/coins with x-api-key header', async () => {
    setupHappyPath();
    await sendTransaction(baseParams);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/v1/wallet/sdk/coins');
    expect((opts.headers as Record<string, string>)['x-api-key']).toBe(API_KEY);
  });

  it('POSTs proof request with correct coinIds', async () => {
    setupHappyPath();
    await sendTransaction(baseParams);
    const [url, opts] = mockFetch.mock.calls[1];
    expect(url).toContain('/v1/wallet/sdk/proofs');
    const body = JSON.parse(opts.body as string);
    expect(body.coinIds).toEqual([COIN_ID_1]);
  });

  it('strips trailing slash from axiaBaseUrl', async () => {
    setupHappyPath();
    await sendTransaction({ ...baseParams, axiaBaseUrl: BASE_URL + '/' });
    const [url] = mockFetch.mock.calls[0];
    expect(url).not.toContain('//v1');
    expect(url).toContain('/v1/wallet/sdk/coins');
  });

  it('calls setUses with l1*64+l2 on the tree key', async () => {
    setupHappyPath();
    await sendTransaction({ ...baseParams, signingIndices: { l1: 3, l2: 7 } });
    const tk = (core.createUnifiedChildTreeKey as jest.Mock).mock.results[0]?.value;
    expect(tk?.setUses).toHaveBeenCalledWith(3 * 64 + 7);
  });

  it('filters coins by tokenId', async () => {
    stubSlowCrypto();
    const mixedCoins = [
      { coinId: COIN_ID_1, address: TO_ADDRESS_HEX, amount: '20', tokenId: '0x00', created: '100', mmrEntry: '5', storeState: false },
      { coinId: COIN_ID_2, address: TO_ADDRESS_HEX, amount: '5', tokenId: '0xfeed', created: '101', mmrEntry: '6', storeState: false },
    ];
    const tokenProofs = [{ coinId: COIN_ID_2, coinProofHex: 'aabbccdd' }];
    makeFetchSequence([
      { ok: true, json: { ok: true, coins: mixedCoins } },
      { ok: true, json: { ok: true, proofs: tokenProofs } },
      { ok: true, json: { ok: true, txpowId: TXPOW_ID } },
    ]);
    mockFetchTarget.mockResolvedValue(FAKE_DIFFICULTY);
    mockSerializeTxBody.mockReturnValue(FAKE_TX_BODY);
    mockMineTxPoW.mockResolvedValue({ minedHeaderBytes: FAKE_MINED_HEADER, txpowId: new Uint8Array(32), source: 'wasm' as const, elapsedMs: 5 });

    await sendTransaction({ ...baseParams, amount: '5', tokenId: '0xfeed' });
    const [, proofsOpts] = mockFetch.mock.calls[1];
    const body = JSON.parse(proofsOpts.body as string);
    expect(body.coinIds).toEqual([COIN_ID_2]);
  });
});
