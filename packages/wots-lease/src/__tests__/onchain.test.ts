/**
 * OnchainWatermarkProvider tests.
 *
 * Covers:
 *   - Reserve/commit/burn delegate to local provider
 *   - publishWatermark builds a self-spend TX advancing STATE(0) and broadcasts it
 *   - publishWatermark skips when the on-chain cursor is already ahead
 *   - publishWatermark throws OnchainWatermarkError when broadcast fails
 *   - syncLeaseJournal advances local watermark from on-chain cursor
 *   - syncLeaseJournal records conflicts when on-chain is behind
 */

import { OnchainWatermarkProvider } from '../onchain';
import { LocalLeaseProvider } from '../local';
import { OnchainWatermarkError } from '../errors';
import { precomputeTransactionCoinID, hexToBytes, bytesToHex } from '@totemsdk/core';

class MemoryStorage {
  private store = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | null> {
    return (this.store.get(key) as T) ?? null;
  }
  async set<T>(key: string, value: T): Promise<void> {
    this.store.set(key, value);
  }
  async remove(key: string): Promise<boolean> {
    return this.store.delete(key);
  }
  async clear(): Promise<void> {
    this.store.clear();
  }
  async keys(): Promise<string[]> {
    return [...this.store.keys()];
  }
  async has(key: string): Promise<boolean> {
    return this.store.has(key);
  }
}

interface MockChain {
  coin: {
    coinid: string;
    address: string;
    amount: string;
    tokenid: string;
    state: Array<{ port: number; data: string }>;
  } | null;
  broadcasts: string[];
  queried: string[];
  rejectBroadcast?: boolean;
  tip: { block: number };
}

function makeChain(initialFlat: number | null): MockChain {
  return {
    coin: initialFlat === null
      ? null
      : {
          coinid: '0x' + 'ab'.repeat(32),
          address: '0x' + 'cd'.repeat(32),
          amount: '1',
          tokenid: '0x00',
          state: [{ port: 0, data: initialFlat.toString(16) }],
        },
    broadcasts: [],
    queried: [],
    tip: { block: 100 },
  };
}

function makeProvider(
  chain: MockChain,
  local: LocalLeaseProvider,
  extra: Partial<ConstructorParameters<typeof OnchainWatermarkProvider>[0]> = {},
) {
  return new OnchainWatermarkProvider({
    chain: {
      getCoin: async (coinId: string) => {
        chain.queried.push(coinId);
        if (!chain.coin) return null;
        return { ...chain.coin, coinid: coinId };
      },
      getProof: async () => ({ data: {} }),
      broadcastTxPoW: async (txpowHex: string) => {
        if (chain.rejectBroadcast) return { success: false, message: 'rejected' };
        chain.broadcasts.push(txpowHex);
        return { success: true, txpowid: '0x' + 'ef'.repeat(32) };
      },
      getTip: async () => chain.tip,
    },
    watermarkCoinId: '0x' + 'ab'.repeat(32),
    watermarkAddress: '0x' + 'cd'.repeat(32),
    local,
    signer: {
      publicKeyDigest: '0x' + '12'.repeat(32),
      sign: async () => new Uint8Array(1088).fill(7),
      verify: async () => true,
    },
    ...extra,
  });
}

function makeLocal() {
  return new LocalLeaseProvider(new MemoryStorage());
}

describe('OnchainWatermarkProvider', () => {
  it('reserve/commit/burn delegate to the local provider', async () => {
    const local = makeLocal();
    const provider = makeProvider(makeChain(0), local);

    const reservation = await provider.reserveKeyUse({ treeId: 'wallet' });
    expect(reservation.indices).toEqual({ addressIndex: 0, l1: 0, l2: 0 });
    expect(reservation.certificate?.issuedBy).toBe('onchain-watermark');

    await provider.commitKeyUse(reservation.reservationId, '0xTX1');
    const wm = await local.getLocalWatermark('wallet');
    expect(wm.unavailableCount).toBe(1);
  });

  it('publishWatermark builds and broadcasts a self-spend advancing STATE(0)', async () => {
    const local = makeLocal();
    const chain = makeChain(0);
    const provider = makeProvider(chain, local);

    await provider.reserveKeyUse({ treeId: 'wallet' });
    await provider.publishWatermark('wallet');

    expect(chain.broadcasts).toHaveLength(1);
    const txHex = chain.broadcasts[0];
    expect(txHex.length).toBeGreaterThan(200);
  });

  it('publishWatermark skips when the on-chain cursor is already ahead', async () => {
    const local = makeLocal();
    const chain = makeChain(10);
    const provider = makeProvider(chain, local);

    await provider.reserveKeyUse({ treeId: 'wallet' });
    await provider.publishWatermark('wallet');

    expect(chain.broadcasts).toHaveLength(0);
  });

  it('publishWatermark throws OnchainWatermarkError when broadcast fails', async () => {
    const local = makeLocal();
    const chain = makeChain(0);
    chain.rejectBroadcast = true;
    const provider = makeProvider(chain, local);

    await provider.reserveKeyUse({ treeId: 'wallet' });
    await expect(provider.publishWatermark('wallet')).rejects.toThrow(OnchainWatermarkError);
  });

  it('publishWatermark throws when the watermark coin is missing', async () => {
    const local = makeLocal();
    const chain = makeChain(null);
    const provider = makeProvider(chain, local);

    await provider.reserveKeyUse({ treeId: 'wallet' });
    await expect(provider.publishWatermark('wallet')).rejects.toThrow(OnchainWatermarkError);
  });

  it('syncLeaseJournal advances local watermark from the on-chain cursor', async () => {
    const local = makeLocal();
    const chain = makeChain(7);
    const provider = makeProvider(chain, local);

    // Create the local tree first (reserve advances local to l2=1)
    await provider.reserveKeyUse({ treeId: 'wallet' });

    const result = await provider.syncLeaseJournal();

    expect(result.synced).toBe(true);
    expect(result.advancedTo).toEqual({ addressIndex: 0, l1: 0, l2: 7 });
    const wm = await local.getLocalWatermark('wallet');
    expect(wm.l2Cursor).toBe(7);
  });

  it('syncLeaseJournal records a conflict when on-chain is behind local', async () => {
    const local = makeLocal();
    const chain = makeChain(0);
    const provider = makeProvider(chain, local);

    await provider.reserveKeyUse({ treeId: 'wallet' });
    const result = await provider.syncLeaseJournal();

    expect(result.synced).toBe(false);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].treeId).toBe('wallet');
  });

  it('verifyLeaseCertificate checks issuer and expiry', async () => {
    const local = makeLocal();
    const provider = makeProvider(makeChain(0), local);

    const reservation = await provider.reserveKeyUse({ treeId: 'wallet' });
    expect(await provider.verifyLeaseCertificate(reservation.certificate)).toBe(true);
    expect(await provider.verifyLeaseCertificate(undefined)).toBe(false);
    expect(
      await provider.verifyLeaseCertificate({ ...reservation.certificate!, expiresAt: Date.now() - 1 }),
    ).toBe(false);
    // Certificates must be signed by the watermark owner.
    expect(
      await provider.verifyLeaseCertificate({ ...reservation.certificate!, signature: '' }),
    ).toBe(false);
  });

  it('rolls the watermark coin forward across consecutive publishes', async () => {
    const local = makeLocal();
    const chain = makeChain(0);
    const initialId = '0x' + 'ab'.repeat(32);
    const provider = makeProvider(chain, local);

    await provider.reserveKeyUse({ treeId: 'wallet' });
    await provider.publishWatermark('wallet');
    // Advance the chain tip past the rate-limit window so the next publish proceeds.
    chain.tip.block = 200;
    await provider.publishWatermark('wallet');

    expect(chain.queried).toHaveLength(2);
    expect(chain.queried[0]).toBe(initialId);
    // The second publish must read the ADVANCED coin, not the consumed one.
    expect(chain.queried[1]).not.toBe(initialId);

    // Deterministic rollover: output coin id of the self-spend (output index 0).
    const expectedRolled = '0x' + bytesToHex(precomputeTransactionCoinID(hexToBytes(initialId), 0));
    expect(chain.queried[1]).toBe(expectedRolled);
  });

  it('persists the advanced watermark coin id across provider restarts', async () => {
    const local = makeLocal();
    const chain = makeChain(0);
    const initialId = '0x' + 'ab'.repeat(32);
    const storage = new MemoryStorage();

    const provider1 = makeProvider(chain, local, { storage });
    await provider1.reserveKeyUse({ treeId: 'wallet' });
    await provider1.publishWatermark('wallet');

    chain.tip.block = 300;
    const provider2 = makeProvider(chain, local, { storage });
    await provider2.initialize();
    await provider2.publishWatermark('wallet');

    const expectedRolled = '0x' + bytesToHex(precomputeTransactionCoinID(hexToBytes(initialId), 0));
    expect(chain.queried).toContain(expectedRolled);
    // The restarted provider's second publish must use the persisted coin id.
    expect(chain.queried[chain.queried.length - 1]).toBe(expectedRolled);
  });
});
