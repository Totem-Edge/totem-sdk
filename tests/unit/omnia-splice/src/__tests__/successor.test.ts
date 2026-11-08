/**
 * RFC-078 §3.5 — successor observation and interrupted-broadcast recovery.
 */

import { observeSpliceSuccessor, recoverInterruptedSplices } from '../successor.js';
import type { PendingSpliceRecord } from '../successor.js';

const ADDRESS = '0x' + 'ab'.repeat(32);
const TOKEN = '0x00';
const coin = (over: Partial<Record<string, unknown>> = {}) => ({
  coinid: '0x' + '11'.repeat(32),
  amount: '1500',
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
          coin({ coinid: '0x' + '22'.repeat(32), amount: '1000', spent: true }),
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
      { getCoins: async () => [coin({ created: '1' })], getTip: async () => ({ block: 100 }) },
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
});
