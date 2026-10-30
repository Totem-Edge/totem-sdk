import { wotsAddressData } from '@totemsdk/core';
/**
 * RFC-038 V3 — per-share VTXO exit transaction.
 */

import type { ChainStateProvider } from '@totemsdk/chain-provider';
import {
  buildExitTransactionDraft,
  exitTransactionDigest,
  buildExitTransaction,
} from '../exit-tx.js';
import { POOL_SHARE_PORT_BASE } from '../pool-script.js';
import type { OmniaVtxo } from '../types.js';

const H0 = '0x' + '22'.repeat(32);
const H1 = '0x' + '33'.repeat(32);

const vtxo = (): OmniaVtxo => ({
  vtxoId: 'v-1',
  poolId: 'p-1',
  owner: H0,
  amount: 500n,
  tokenId: '0x00',
  status: 'exiting',
  epoch: 1,
  proof: { leaf: '', root: '', siblings: [], positions: [], epoch: 1, batchId: '' },
  history: [],
  createdAt: 1,
  updatedAt: 1,
});

const params = () => ({
  vtxo: vtxo(),
  fundingCoinId: '0x' + 'cc'.repeat(32),
  fundingAddress: '0x' + 'dd'.repeat(32),
  fundingScript: 'RETURN TRUE',
  amount: 1000n,
  holders: [H0, H1],
  shares: [500n, 500n],
  holderIndex: 0,
  root: '0x' + 'bb'.repeat(32),
  epoch: 1,
  exitBlock: 1000,
});

describe('exit transaction (RFC-038 V3 — per-share)', () => {
  it("pays output 0 only the holder's share, remainder back to the pool", () => {
    const draft = buildExitTransactionDraft(params());
    expect(draft.outputs[0].address).toBe(wotsAddressData(H0));
    expect(draft.outputs[0].amount).toBe(500n);
    expect(draft.outputs[0].storeState).toBe(false);
    expect(draft.outputs[1].address).toBe(params().fundingAddress);
    expect(draft.outputs[1].amount).toBe(500n);
    // remainder state zeroes the exiting holder's share, keeps the others'
    const st = draft.outputs[1].stateVariables;
    expect(st).toContainEqual({ port: POOL_SHARE_PORT_BASE, value: 0n, type: 'number' });
    expect(st).toContainEqual({ port: POOL_SHARE_PORT_BASE + 1, value: 500n, type: 'number' });
  });

  it('omits the remainder output when the share is the whole pool', () => {
    const p = params();
    const draft = buildExitTransactionDraft({ ...p, shares: [1000n], holders: [H0], amount: 1000n });
    expect(draft.outputs).toHaveLength(1);
    expect(draft.storeState).toBe(false);
  });

  it('produces a stable digest + tx hex', () => {
    const a = Buffer.from(exitTransactionDigest(buildExitTransactionDraft(params()))).toString('hex');
    const b = Buffer.from(exitTransactionDigest(buildExitTransactionDraft(params()))).toString('hex');
    expect(a).toBe(b);
  });

  it('rejects an out-of-range holder index or zero share', () => {
    expect(() => buildExitTransactionDraft({ ...params(), holderIndex: 5 })).toThrow(/holderIndex/);
    expect(() => buildExitTransactionDraft({ ...params(), shares: [0n, 1000n] })).toThrow(/share must be positive/);
  });

  it('builds + signs without broadcasting (no chain provider)', async () => {
    const result = await buildExitTransaction(params(), { signDigest: async () => new Uint8Array(1088).fill(1) });
    expect(result.draftType).toBe('vtxo-exit');
    expect(result.share).toBe('500');
    expect(result.txHex).toBeTruthy();
    expect(result.txpowId).toBeUndefined();
  });

  it('mines + broadcasts when a chain provider is supplied', async () => {
    const broadcastTxPoW = jest.fn(async () => ({ success: true }));
    const result = await buildExitTransaction(params(), {
      signDigest: async () => new Uint8Array(1088).fill(1),
      chainProvider: { broadcastTxPoW } as unknown as ChainStateProvider,
      mine: async () => ({ minedHeaderBytes: new Uint8Array(80).fill(1), txpowId: new Uint8Array(32).fill(2) }),
    });
    expect(result.txpowId).toBeTruthy();
    expect(broadcastTxPoW).toHaveBeenCalledTimes(1);
  });
});
