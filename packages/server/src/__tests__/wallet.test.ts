/**
 * Tests for MinimaWallet (wallet.ts)
 *
 * Tree key creation and address derivation are mocked so all tests run in <1s.
 * The mocks are deterministic: the same index always produces the same fake key,
 * which lets determinism and export/import tests remain meaningful.
 *
 * What is tested:
 *   - Business logic (account creation, index tracking, MAX_ADDRESSES guard)
 *   - Correct arguments to signing primitives (setUses = l1*64+l2)
 *   - Export + import AES round-trip (real encryption, mocked address derivation)
 *   - Minima-format (Mx) address shape from real scriptFromWotsPk / scriptToAddress
 */
import * as core from '@totemsdk/core';
import { MinimaWallet } from '../wallet';
import type { MinimaClient, Transaction, TransactionParams } from '../wallet';

// ─── stub client ──────────────────────────────────────────────────────────────

const stubClient: MinimaClient = {
  getBalance:       async () => '100',
  buildTransaction: async (_p: TransactionParams): Promise<Transaction> => ({ inputs: [], outputs: [] }),
  submitTransaction: async () => '0xTXPOWID',
};

const TEST_PHRASE = 'ABLE ABLE ABLE ABLE ABLE ABLE ABLE ABLE ABLE ABLE ABLE ABLE ABLE ABLE ABLE ABLE ABLE ABLE ABLE ABLE ABLE ABLE ABLE ABLE';

// ─── fast crypto mocks ────────────────────────────────────────────────────────

function mockAddressDerivation() {
  // Returns a deterministic 32-byte key per index so addresses are stable across calls.
  jest.spyOn(core, 'deriveUnifiedAddressPublicKey')
    .mockImplementation((_seed: Uint8Array, index: number) => {
      const key = new Uint8Array(32);
      key[0] = index & 0xff;
      key[1] = (index >> 8) & 0xff;
      return key;
    });
}

function mockTreeKey() {
  const tk = { setUses: jest.fn(), sign: jest.fn().mockReturnValue({}) };
  jest.spyOn(core, 'createUnifiedChildTreeKey').mockReturnValue(tk as any);
  jest.spyOn(core, 'serializeTreeSignature').mockReturnValue(new Uint8Array([0xaa, 0xbb, 0xcc]));
  return tk;
}

afterEach(() => jest.restoreAllMocks());

// ─── tests ────────────────────────────────────────────────────────────────────

describe('MinimaWallet — seed phrase utilities', () => {
  it('generateSeedPhrase returns a 24-word phrase in uppercase', () => {
    const wallet = new MinimaWallet({ client: stubClient });
    const phrase = wallet.generateSeedPhrase();
    expect(phrase.trim().split(/\s+/)).toHaveLength(24);
    expect(phrase).toBe(phrase.toUpperCase());
  });

  it('validateSeedPhrase accepts a valid 24-word phrase', () => {
    const wallet = new MinimaWallet({ client: stubClient });
    expect(wallet.validateSeedPhrase(TEST_PHRASE)).toBe(true);
  });

  it('validateSeedPhrase rejects nonsense', () => {
    const wallet = new MinimaWallet({ client: stubClient });
    expect(wallet.validateSeedPhrase('foo bar baz')).toBe(false);
  });
});

describe('MinimaWallet — account derivation', () => {
  beforeEach(() => mockAddressDerivation());

  it('derives an Mx-format address (real scriptFromWotsPk / scriptToAddress)', async () => {
    const wallet = new MinimaWallet({ client: stubClient });
    await wallet.initialize(TEST_PHRASE);
    const addr = wallet.getAccounts()[0].address;
    expect(addr.toUpperCase().startsWith('MX')).toBe(true);
  });

  it('same seed → same first address (determinism via mocked pub key)', async () => {
    const w1 = new MinimaWallet({ client: stubClient });
    await w1.initialize(TEST_PHRASE);
    const w2 = new MinimaWallet({ client: stubClient });
    await w2.initialize(TEST_PHRASE);
    expect(w1.getAccounts()[0].address).toBe(w2.getAccounts()[0].address);
  });

  it('createAccount increments index', async () => {
    const wallet = new MinimaWallet({ client: stubClient });
    await wallet.initialize(TEST_PHRASE);
    const before = wallet.getAccounts().length;
    const acct = await wallet.createAccount();
    expect(wallet.getAccounts()).toHaveLength(before + 1);
    expect(acct.index).toBe(before);
  });

  it('getAccountByIndex returns the account at that index', async () => {
    const wallet = new MinimaWallet({ client: stubClient });
    await wallet.initialize(TEST_PHRASE);
    const acct = wallet.getAccountByIndex(0);
    expect(acct).toBeDefined();
    expect(acct!.index).toBe(0);
  });

  it('getAccount returns undefined for an unknown address', async () => {
    const wallet = new MinimaWallet({ client: stubClient });
    await wallet.initialize(TEST_PHRASE);
    expect(wallet.getAccount('MxUNKNOWN')).toBeUndefined();
  });

  it('throws when MAX_ADDRESSES is reached', async () => {
    const wallet = new MinimaWallet({ client: stubClient });
    await wallet.initialize(TEST_PHRASE);
    (wallet as any).currentIndex = MinimaWallet.MAX_ADDRESSES;
    await expect(wallet.createAccount()).rejects.toThrow('Maximum addresses');
  });
});

describe('MinimaWallet — signing', () => {
  beforeEach(() => {
    mockAddressDerivation();
    mockTreeKey();
  });

  it('signData returns a non-empty hex string', async () => {
    const wallet = new MinimaWallet({ client: stubClient });
    await wallet.initialize(TEST_PHRASE);
    const sig = await wallet.signData(new Uint8Array(32).fill(0xab), 0, { l1: 5, l2: 3 });
    expect(typeof sig).toBe('string');
    expect(sig.length).toBeGreaterThan(2);
    // bytesToHex returns '0x' + hex
    expect(/^0x[0-9a-fA-F]+$/.test(sig)).toBe(true);
  });

  it('calls setUses(l1*64 + l2)', async () => {
    const wallet = new MinimaWallet({ client: stubClient });
    await wallet.initialize(TEST_PHRASE);
    await wallet.signData(new Uint8Array(32), 0, { l1: 5, l2: 3 });
    const tk = (core.createUnifiedChildTreeKey as jest.Mock).mock.results[0].value;
    expect(tk.setUses).toHaveBeenCalledWith(5 * 64 + 3);
  });

  it('signData throws before TreeKey creation when hash ≠ 32 bytes', async () => {
    const wallet = new MinimaWallet({ client: stubClient });
    await wallet.initialize(TEST_PHRASE);
    await expect(wallet.signData(new Uint8Array(16), 0, { l1: 0, l2: 0 })).rejects.toThrow('32 bytes');
    expect(core.createUnifiedChildTreeKey).not.toHaveBeenCalled();
  });

  it('signData throws on invalid l1', async () => {
    const wallet = new MinimaWallet({ client: stubClient });
    await wallet.initialize(TEST_PHRASE);
    await expect(wallet.signData(new Uint8Array(32), 0, { l1: 64, l2: 0 })).rejects.toThrow('Invalid l1');
  });

  it('signData throws on invalid l2', async () => {
    const wallet = new MinimaWallet({ client: stubClient });
    await wallet.initialize(TEST_PHRASE);
    await expect(wallet.signData(new Uint8Array(32), 0, { l1: 0, l2: 64 })).rejects.toThrow('Invalid l2');
  });

  it('signTransaction calls sign() and returns hex', async () => {
    const wallet = new MinimaWallet({ client: stubClient });
    await wallet.initialize(TEST_PHRASE);
    const addr = wallet.getAccounts()[0].address;
    const sig = await wallet.signTransaction({ inputs: [], outputs: [] }, addr, { l1: 2, l2: 7 });
    expect(/^0x[0-9a-fA-F]+$/.test(sig)).toBe(true);
    const tk = (core.createUnifiedChildTreeKey as jest.Mock).mock.results[0].value;
    expect(tk.setUses).toHaveBeenCalledWith(2 * 64 + 7);
  });

  it('signTransaction throws for unknown address', async () => {
    const wallet = new MinimaWallet({ client: stubClient });
    await wallet.initialize(TEST_PHRASE);
    await expect(wallet.signTransaction({}, 'MxNOTHERE', { l1: 0, l2: 0 })).rejects.toThrow('Account not found');
  });

  it('clearTreeKeyCache resets cachedTreeKeys to 0', async () => {
    const wallet = new MinimaWallet({ client: stubClient });
    await wallet.initialize(TEST_PHRASE);
    await wallet.signData(new Uint8Array(32), 0, { l1: 0, l2: 0 });
    expect(wallet.getStats().cachedTreeKeys).toBeGreaterThan(0);
    wallet.clearTreeKeyCache();
    expect(wallet.getStats().cachedTreeKeys).toBe(0);
  });
});

describe('MinimaWallet — export / import', () => {
  beforeEach(() => mockAddressDerivation());

  it('round-trip preserves addresses', async () => {
    const wallet = new MinimaWallet({ client: stubClient });
    await wallet.initialize(TEST_PHRASE);
    const original = wallet.getAccounts().map(a => a.address);

    const encrypted = await wallet.export('test-password');
    expect(typeof encrypted).toBe('string');
    expect(encrypted.length).toBeGreaterThan(50);

    const wallet2 = new MinimaWallet({ client: stubClient });
    await wallet2.import(encrypted, 'test-password');
    expect(wallet2.getAccounts().map(a => a.address)).toEqual(original);
  });
});

describe('MinimaWallet — getStats', () => {
  beforeEach(() => mockAddressDerivation());

  it('returns correct account count and no cached tree keys before signing', async () => {
    const wallet = new MinimaWallet({ client: stubClient });
    await wallet.initialize(TEST_PHRASE);
    const stats = wallet.getStats();
    expect(stats.accountCount).toBeGreaterThan(0);
    expect(stats.maxAddresses).toBe(MinimaWallet.MAX_ADDRESSES);
    expect(stats.cachedTreeKeys).toBe(0);
  });
});

describe('MinimaWallet — updateBalances', () => {
  beforeEach(() => mockAddressDerivation());

  it('calls getBalance for each account and stores the result', async () => {
    const spy = jest.fn().mockResolvedValue('42.5');
    const wallet = new MinimaWallet({ client: { ...stubClient, getBalance: spy } });
    await wallet.initialize(TEST_PHRASE);
    await wallet.updateBalances();
    const accounts = wallet.getAccounts();
    expect(spy).toHaveBeenCalledTimes(accounts.length);
    expect(accounts[0].balance).toBe('42.5');
  });
});
