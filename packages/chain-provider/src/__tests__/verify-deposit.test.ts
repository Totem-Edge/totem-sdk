import { MMRTree } from '@totemsdk/core';
import {
  depositAddressFor,
  verifyDeposit,
  verifyDepositMmrProof,
  withDepositVerifier,
} from '../verify-deposit';
import { MinimaRpcProvider } from '../providers/minima-rpc';
import type { ChainStateProvider } from '../types';
import type { MinimaRpcClient } from '@totemsdk/minima-rpc';

const baseCoin = {
  coinid: '0xC1',
  amount: '250000',
  address: 'MxLP',
  tokenid: '0x00',
  spent: false,
};

function providerWith(coin: unknown): Pick<ChainStateProvider, 'getCoin'> {
  return { getCoin: jest.fn().mockResolvedValue(coin) };
}

describe('verifyDeposit', () => {
  it('passes all gates for an unspent, owned, sufficiently funded coin', async () => {
    const result = await verifyDeposit(
      providerWith(baseCoin),
      { coinId: '0xC1', ownerAddress: 'MxLP', tokenId: '0x00', claimedAmount: '100000' },
    );
    expect(result).toEqual(expect.objectContaining({
      valid: true,
      exists: true,
      unspent: true,
      ownedByOwner: true,
      tokenMatches: true,
      amountSufficient: true,
    }));
  });

  it('rejects a spent coin', async () => {
    const result = await verifyDeposit(
      providerWith({ ...baseCoin, spent: true }),
      { coinId: '0xC1', ownerAddress: 'MxLP' },
    );
    expect(result.valid).toBe(false);
    expect(result.unspent).toBe(false);
  });

  it('rejects a coin owned by a different address', async () => {
    const result = await verifyDeposit(
      providerWith({ ...baseCoin, address: 'MxATTACKER' }),
      { coinId: '0xC1', ownerAddress: 'MxLP' },
    );
    expect(result.valid).toBe(false);
    expect(result.ownedByOwner).toBe(false);
  });

  it('rejects a token mismatch', async () => {
    const result = await verifyDeposit(
      providerWith({ ...baseCoin, tokenid: '0xUSDT' }),
      { coinId: '0xC1', ownerAddress: 'MxLP', tokenId: '0x00' },
    );
    expect(result.valid).toBe(false);
    expect(result.tokenMatches).toBe(false);
  });

  it('rejects an insufficient amount and accepts base token when none requested', async () => {
    const short = await verifyDeposit(
      providerWith({ ...baseCoin, amount: '99' }),
      { coinId: '0xC1', ownerAddress: 'MxLP', claimedAmount: '100' },
    );
    expect(short.valid).toBe(false);
    expect(short.amountSufficient).toBe(false);

    const baseOk = await verifyDeposit(
      providerWith(baseCoin),
      { coinId: '0xC1', ownerAddress: 'MxLP', claimedAmount: '100' },
    );
    expect(baseOk.tokenMatches).toBe(true);
    expect(baseOk.valid).toBe(true);
  });

  it('compares fractional MiniNumber amounts by scaling, not string length', async () => {
    const result = await verifyDeposit(
      providerWith({ ...baseCoin, amount: '250000.00000000' }),
      { coinId: '0xC1', ownerAddress: 'MxLP', claimedAmount: '0.50000000' },
    );
    expect(result.amountSufficient).toBe(true);
    expect(result.valid).toBe(true);
  });

  it('reports missing coin as exists:false', async () => {
    const result = await verifyDeposit(providerWith(null), { coinId: '0xC1', ownerAddress: 'MxLP' });
    expect(result.exists).toBe(false);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/not found/);
  });

  it('reports unavailable when the provider throws', async () => {
    const result = await verifyDeposit(
      { getCoin: jest.fn().mockRejectedValue(new Error('disconnected')) },
      { coinId: '0xC1', ownerAddress: 'MxLP' },
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('unable to reach chain provider');
  });
});

describe('depositAddressFor', () => {
  it('is deterministic and domain-scoped', () => {
    const a = depositAddressFor('MxLP');
    expect(a).toBe(depositAddressFor('MxLP'));
    expect(a.startsWith('Mx')).toBe(true);
    expect(depositAddressFor('MxLP')).not.toBe(depositAddressFor('MxOTHER'));
    expect(depositAddressFor('MxLP', { poolId: 'pool-1' })).not.toBe(
      depositAddressFor('MxLP', { poolId: 'pool-2' }),
    );
    expect(depositAddressFor('MxLP', { tokenId: '0xUSDT' })).not.toBe(depositAddressFor('MxLP'));
  });
});

describe('withDepositVerifier', () => {
  it('delegates verifyDeposit and exposes the verifier port', async () => {
    const provider = {
      ...providerWith(baseCoin),
      getProof: jest.fn(),
      getTip: jest.fn(),
      getToken: jest.fn(),
      searchTokens: jest.fn(),
      getTokensByCreator: jest.fn(),
      broadcastTxPoW: jest.fn(),
      getCoins: jest.fn(),
    };
    const verifier = withDepositVerifier(provider);
    const result = await verifier.verifyDeposit({ coinId: '0xC1', ownerAddress: 'MxLP' });
    expect(result.valid).toBe(true);
    expect(await verifier.getMmrRoot()).toBeNull();
    expect(typeof verifier.depositAddressFor('MxLP')).toBe('string');
  });
});

describe('MinimaRpcProvider deposit verifier', () => {
  it('uses coincheck for the live check and megammr for the MMR root', async () => {
    const client = {
      coinCheck: jest.fn().mockResolvedValue({ found: true, spent: false, coin: baseCoin }),
      megammr: jest.fn().mockResolvedValue({ size: '8', block: 42, hash: '0xROOT' }),
    } as unknown as MinimaRpcClient;
    const provider = new MinimaRpcProvider(client);

    const result = await provider.verifyDeposit({ coinId: '0xC1', ownerAddress: 'MxLP', claimedAmount: '100000' });
    expect(result.valid).toBe(true);
    expect(client.coinCheck).toHaveBeenCalledWith('0xC1');

    expect(await provider.getMmrRoot()).toBe('0xROOT');
    expect(provider.depositAddressFor('MxLP').startsWith('Mx')).toBe(true);
  });
});

describe('verifyDepositMmrProof', () => {
  it('verifies a real chunk proof against the tree root', () => {
    const pubkeys = [0, 1, 2, 3].map((i) => new Uint8Array([i, i, i, i]));
    const tree = MMRTree.fromPublicKeys(pubkeys);
    const root = tree.getRoot();
    const proof = tree.getProof(1);
    expect(root).not.toBeNull();

    expect(verifyDepositMmrProof(pubkeys[1], proof as never, root!.data as never)).toBe(true);
    const forgery = new Uint8Array(root!.data.length).fill(0xff);
    expect(verifyDepositMmrProof(pubkeys[1], proof as never, forgery)).toBe(false);
    expect(verifyDepositMmrProof(pubkeys[2], proof as never, root!.data as never)).toBe(false);
  });
});