/**
 * RFC-038 V2 — VTXO exit transaction.
 */

import type { ChainStateProvider } from '@totemsdk/chain-provider';
import {
  buildExitTransactionDraft,
  exitTransactionDigest,
  buildExitTransaction,
  EXIT_DELAY_PORT,
} from '../exit-tx.js';
import type { OmniaVtxo } from '../types.js';

const vtxo = (): OmniaVtxo => ({
  vtxoId: 'v-1',
  poolId: 'p-1',
  owner: '0x' + '22'.repeat(32),
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
  amount: 500n,
  exitDelayBlocks: 256,
});

describe('exit transaction (RFC-038 V2)', () => {
  it('encodes the exit delay and produces a stable digest + tx hex', () => {
    const draft = buildExitTransactionDraft(params());
    expect(draft.stateVariables.some((v) => v.port === EXIT_DELAY_PORT)).toBe(true);
    const a = Buffer.from(exitTransactionDigest(draft)).toString('hex');
    const b = Buffer.from(exitTransactionDigest(buildExitTransactionDraft(params()))).toString('hex');
    expect(a).toBe(b);
  });

  it('builds + signs without broadcasting (no chain provider)', async () => {
    const result = await buildExitTransaction(params(), { signDigest: async () => new Uint8Array(1088).fill(1) });
    expect(result.draftType).toBe('vtxo-exit');
    expect(result.txHex).toBeTruthy();
    expect(result.txpowId).toBeUndefined();
    expect(result.exitDelayBlocks).toBe(256);
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
