/**
 * RFC-078 §3.5 — successor observation and interrupted-broadcast recovery.
 */

import { observeSpliceSuccessor, recoverInterruptedSplices } from '../successor.js';
import type { PendingSpliceRecord } from '../successor.js';

const ADDRESS = '0x' + 'ab'.repeat(32);
const TOKEN = '0x00';
const coin = (over: Partial<Record<string, unknown>> = {}) => ({
  coinid: '0x' + '11'.repeat(32),
  amount: 1500,
  address: ADDRESS,
  tokenid: TOKEN,
  spent: false,
  created: '100',
  ...over,
});

describe('observeSpliceSuccessor', () => {
  it('ignores the spent old coin and reports a confirmed successor', async () => {
    const observed = await observeSpliceSuccessor(
      {
        getCoins: async () => [
          coin({ coinid: '0x' + '22'.repeat(32), amount: 1000, spent: true }),
          coin(),
        ],
        getTip: async () => ({ block: 105 }),
      },
      { address: ADDRESS, tokenId: TOKEN, amount: 1500n, confirmations: 3, timeoutMs: 0 },
    );
    expect(observed?.coinId).toBe('0x' + '11'.repeat(32));
    expect(observed?.confirmed).toBe(true);
    expect(observed?.confirmations).toBe(6);
  });

  it('reports an unconfirmed successor as funding-pending', async () => {
    const observed = await observeSpliceSuccessor(
      {
        getCoins: async () => [coin({ created: '104' })],
        getTip: async () => ({ block: 105 }),
      },
      { address: ADDRESS, tokenId: TOKEN, amount: 1500n, confirmations: 3, timeoutMs: 0 },
    );
    expect(observed?.confirmed).toBe(false);
  });
});

describe('observeSpliceSuccessor — ambiguity (CAN-012)', () => {
  it('refuses to pick between two identical unspent candidates', async () => {
    await expect(observeSpliceSuccessor(
      {
        getCoins: async () => [
          coin({ coinid: '0x' + '33'.repeat(32) }),
          coin({ coinid: '0x' + '44'.repeat(32) }),
        ],
        getTip: async () => ({ block: 105 }),
      },
      { address: ADDRESS, tokenId: TOKEN, amount: 1500n, confirmations: 1, timeoutMs: 0 },
    )).rejects.toThrow(/Ambiguous splice successor: 2 unspent coins/);
  });

  it('still accepts a single matching successor', async () => {
    const observed = await observeSpliceSuccessor(
      {
        getCoins: async () => [coin(), coin({ coinid: '0x' + '55'.repeat(32), amount: '900' })],
        getTip: async () => ({ block: 105 }),
      },
      { address: ADDRESS, tokenId: TOKEN, amount: 1500n, confirmations: 1, timeoutMs: 0 },
    );
    expect(observed?.coinId).toBe('0x' + '11'.repeat(32));
  });
});

describe('recoverInterruptedSplices', () => {
  const record: PendingSpliceRecord = {
    spliceId: 'splice-1',
    channelId: 'chan-1',
    txHex: 'beef',
    txpowId: 'tx-1',
    broadcastAt: 1,
  };

  function store(entries: PendingSpliceRecord[]) {
    const pending = [...entries];
    const cleared: string[] = [];
    return {
      saved: [] as PendingSpliceRecord[],
      async save(value: PendingSpliceRecord) { this.saved.push(value); },
      async clear(id: string) { cleared.push(id); },
      async list() { return [...pending]; },
      cleared,
    };
  }

  it('clears the journal when the successor is already confirmed', async () => {
    const journal = store([record]);
    const results = await recoverInterruptedSplices(
      journal,
      {
        getCoins: async () => [coin({ created: '1' })],
        getTip: async () => ({ block: 100 }),
        getTransactionOutputs: async () => ['0x' + '11'.repeat(32)],
      },
      { address: ADDRESS, tokenId: TOKEN, amount: 1500n, confirmations: 1 },
      async () => ({ success: true }),
    );
    expect(results[0].status).toBe('active');
    expect(results[0].rebroadcast).toBe(false);
    expect(journal.cleared).toEqual(['splice-1']);
  });

  it('rebroadcasts the exact tx when the successor is missing', async () => {
    const journal = store([record]);
    const broadcasts: string[] = [];
    const results = await recoverInterruptedSplices(
      journal,
      { getCoins: async () => [], getTip: async () => ({ block: 100 }) },
      { address: ADDRESS, tokenId: TOKEN, amount: 1500n, confirmations: 1 },
      async (txHex) => { broadcasts.push(txHex); return { txpowid: 'tx-1' }; },
    );
    expect(broadcasts).toEqual(['beef']);
    expect(results[0].status).toBe('funding_pending');
    expect(results[0].rebroadcast).toBe(true);
  });

  it('OMN-014: binds each pending splice to its own expected successor', async () => {
    const journal = store([
      { ...record, spliceId: 'splice-a', expected: { address: ADDRESS, tokenId: TOKEN, amount: '1000' } },
      { ...record, spliceId: 'splice-b', expected: { address: ADDRESS, tokenId: TOKEN, amount: '2000' } },
    ]);
    const results = await recoverInterruptedSplices(
      journal,
      {
        getCoins: async () => [
          coin({ coinid: '0x' + '11'.repeat(32), amount: 1000, created: '1' }),
          coin({ coinid: '0x' + '22'.repeat(32), amount: 2000, created: '1' }),
        ],
        getTip: async () => ({ block: 100 }),
        getTransactionOutputs: async () => ['0x' + '11'.repeat(32), '0x' + '22'.repeat(32)],
      },
      { address: ADDRESS, tokenId: TOKEN, amount: 0n, confirmations: 1 },
      async () => ({ success: true }),
    );
    expect(results.map((r) => `${r.spliceId}:${r.coinId}`)).toEqual([
      'splice-a:0x' + '11'.repeat(32),
      'splice-b:0x' + '22'.repeat(32),
    ]);
    expect(journal.cleared).toEqual(['splice-a', 'splice-b']);
  });

  it('OMN-014: one successor coin cannot settle two pending splices', async () => {
    const journal = store([
      { ...record, spliceId: 'splice-a', expected: { address: ADDRESS, tokenId: TOKEN, amount: '1500' } },
      { ...record, spliceId: 'splice-b', expected: { address: ADDRESS, tokenId: TOKEN, amount: '1500' } },
    ]);
    const results = await recoverInterruptedSplices(
      journal,
      {
        getCoins: async () => [coin({ created: '1' })],
        getTip: async () => ({ block: 100 }),
        getTransactionOutputs: async () => ['0x' + '11'.repeat(32)],
      },
      { address: ADDRESS, tokenId: TOKEN, amount: 1500n, confirmations: 1 },
      async () => ({ success: true }),
    );
    expect(results[0].status).toBe('active');
    expect(results[1].status).toBe('funding_pending');
    expect(results[1].error).toMatch(/already claimed/);
    expect(journal.cleared).toEqual(['splice-a']);
  });

  it('OMN-014: refuses a successor that is not the coin recorded for the splice', async () => {
    const journal = store([{ ...record, coinId: '0x' + '33'.repeat(32) }]);
    const results = await recoverInterruptedSplices(
      journal,
      { getCoins: async () => [coin({ created: '1' })], getTip: async () => ({ block: 100 }) },
      { address: ADDRESS, tokenId: TOKEN, amount: 1500n, confirmations: 1 },
      async () => ({ success: true }),
    );
    expect(results[0].status).toBe('funding_pending');
    expect(results[0].error).toMatch(/does not match the coin recorded/);
    expect(journal.cleared).toEqual([]);
  });

  it('OMN-014: persists the observed coin id while the successor is unconfirmed', async () => {
    const journal = store([record]);
    await recoverInterruptedSplices(
      journal,
      { getCoins: async () => [coin({ created: '100' })], getTip: async () => ({ block: 100 }) },
      { address: ADDRESS, tokenId: TOKEN, amount: 1500n, confirmations: 5 },
      async () => ({ success: true }),
    );
    expect(journal.saved.map((entry) => entry.coinId)).toEqual(['0x' + '11'.repeat(32)]);
  });
});

describe('observeSpliceSuccessor — successor lineage (OMN-072)', () => {
  const SPLICE_TX = 'tx-splice-1';
  const successorId = '0x' + '11'.repeat(32);

  it('ignores a matching coin the splice transaction did not create', async () => {
    const observed = await observeSpliceSuccessor(
      {
        getCoins: async () => [
          coin(),
          coin({ coinid: '0x' + '99'.repeat(32), amount: 1500 }),
        ],
        getTip: async () => ({ block: 105 }),
        // The splice only created the other output.
        getTransactionOutputs: async () => ['0x' + '99'.repeat(32)],
      },
      {
        address: ADDRESS,
        tokenId: TOKEN,
        amount: 1500n,
        confirmations: 1,
        timeoutMs: 0,
        spliceTxpowId: SPLICE_TX,
      },
    );

    expect(observed?.coinId).toBe('0x' + '99'.repeat(32));
    expect(observed?.lineageVerified).toBe(true);
  });

  it('adopts nothing when every matching coin was created elsewhere', async () => {
    const observed = await observeSpliceSuccessor(
      {
        getCoins: async () => [coin({ createdBy: 'tx-someone-else' })],
        getTip: async () => ({ block: 105 }),
        getTransactionOutputs: async () => ['0x' + 'aa'.repeat(32)],
      },
      {
        address: ADDRESS,
        tokenId: TOKEN,
        amount: 1500n,
        confirmations: 1,
        timeoutMs: 0,
        spliceTxpowId: SPLICE_TX,
      },
    );

    expect(observed).toBeNull();
  });

  it('uses the coin creator when the chain cannot list transaction outputs', async () => {
    const wrong = await observeSpliceSuccessor(
      {
        getCoins: async () => [coin({ createdBy: 'tx-someone-else' })],
        getTip: async () => ({ block: 105 }),
      },
      { address: ADDRESS, tokenId: TOKEN, amount: 1500n, confirmations: 1, timeoutMs: 0, spliceTxpowId: SPLICE_TX },
    );
    expect(wrong).toBeNull();

    const right = await observeSpliceSuccessor(
      {
        getCoins: async () => [coin({ createdBy: SPLICE_TX })],
        getTip: async () => ({ block: 105 }),
      },
      { address: ADDRESS, tokenId: TOKEN, amount: 1500n, confirmations: 1, timeoutMs: 0, spliceTxpowId: SPLICE_TX },
    );
    expect(right?.lineageVerified).toBe(true);
    expect(right?.coinId).toBe(successorId);
  });

  it('reports unproven lineage rather than claiming it', async () => {
    const observed = await observeSpliceSuccessor(
      { getCoins: async () => [coin()], getTip: async () => ({ block: 105 }) },
      { address: ADDRESS, tokenId: TOKEN, amount: 1500n, confirmations: 1, timeoutMs: 0, spliceTxpowId: SPLICE_TX },
    );

    expect(observed?.lineageVerified).toBe(false);
    expect(observed?.confirmed).toBe(true);
  });

  it('never treats the old funding coin as the successor', async () => {
    const observed = await observeSpliceSuccessor(
      {
        getCoins: async () => [coin({ coinid: '0x' + '22'.repeat(32) })],
        getTip: async () => ({ block: 105 }),
        getTransactionOutputs: async () => [],
      },
      {
        address: ADDRESS,
        tokenId: TOKEN,
        amount: 1500n,
        confirmations: 1,
        timeoutMs: 0,
        predecessorCoinId: '0x' + '22'.repeat(32),
      },
    );

    expect(observed).toBeNull();
  });
});
