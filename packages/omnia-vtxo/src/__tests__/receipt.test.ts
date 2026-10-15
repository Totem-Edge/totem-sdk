/**
 * RFC-038 V0 — VTXO receipt co-signing (verify-before-sign).
 */

import { createUnifiedChildTreeKey } from '@totemsdk/core';
import type { WotsLeaseProvider } from '@totemsdk/wots-lease';
import { createVtxoOperator } from '../operator.js';
import { signVtxoReceipt, verifyVtxoReceipt } from '../receipt.js';
import { computeCommitmentRoot, computeVtxoLeaf } from '../commitment.js';
import type { OmniaVtxo, VtxoOperatorReceipt } from '../types.js';

function mockLease(): WotsLeaseProvider {
  let c = 0;
  return {
    reserveKeyUse: jest.fn(async () => ({ reservationId: `r-${++c}`, indices: { addressIndex: 0, l1: 0, l2: c - 1 }, expiresAt: Date.now() + 3_600_000 })),
    commitKeyUse: jest.fn(async () => {}),
    burnReservation: jest.fn(async () => {}),
    getLocalWatermark: async (treeId: string) => ({ treeId, addressCursor: 0, l1Cursor: 0, l2Cursor: 0, unavailableCount: 0, capacity: 4096 }),
    publishWatermark: async () => {},
    syncLeaseJournal: async () => ({ synced: true, conflicts: [] }),
    verifyLeaseCertificate: async () => true,
  } as unknown as WotsLeaseProvider;
}

const vtxo = (id: string, owner: string, amount: bigint, epoch = 1): OmniaVtxo => ({
  vtxoId: id,
  poolId: 'pool-1',
  owner,
  amount,
  tokenId: '0x00',
  status: 'active',
  epoch,
  proof: { leaf: '', root: '', siblings: [], positions: [], epoch, batchId: '' },
  history: [],
  createdAt: 1,
  updatedAt: 1,
});

const outputs = [vtxo('v2', '0x' + '22'.repeat(32), 100n), vtxo('v3', '0x' + '33'.repeat(32), 200n)];
const root = computeCommitmentRoot(outputs.map(computeVtxoLeaf));

const receipt = (over: Partial<VtxoOperatorReceipt> = {}): VtxoOperatorReceipt => ({
  receiptId: 'rcpt-1',
  poolId: 'pool-1',
  op: 'transfer',
  inputIds: ['v1'],
  outputIds: ['v2', 'v3'],
  epoch: 1,
  at: 1,
  signature: '',
  ...over,
});

describe('signVtxoReceipt / verifyVtxoReceipt (RFC-038 V0)', () => {
  const treeKey = createUnifiedChildTreeKey(new Uint8Array(32).fill(9), 0);
  const operator = () => createVtxoOperator({ poolId: 'pool-1', treeKey, leaseProvider: mockLease() });

  it('co-signs a receipt after verifying the batch, and verifies it', async () => {
    const op = operator();
    const signed = await signVtxoReceipt(op, receipt(), { outputs, root, epoch: 1 });
    expect(signed.signature).toBeTruthy();
    expect(await verifyVtxoReceipt(op, signed, root)).toBe(true);
    expect(await verifyVtxoReceipt(op, signed, '0x' + 'ff'.repeat(32))).toBe(false);
  });

  it('rejects a root that does not commit the leaves', async () => {
    await expect(
      signVtxoReceipt(operator(), receipt(), { outputs, root: '0x' + '00'.repeat(32), epoch: 1 }),
    ).rejects.toThrow(/commit/);
  });

  it('rejects a stale epoch (monotonicity)', async () => {
    await expect(
      signVtxoReceipt(operator(), receipt(), { outputs, root, epoch: 1, previousEpoch: 1 }),
    ).rejects.toThrow(/not greater/);
  });

  it('rejects an output that is not in the batch', async () => {
    await expect(
      signVtxoReceipt(operator(), receipt({ outputIds: ['vX'] }), { outputs, root, epoch: 1 }),
    ).rejects.toThrow(/not a VTXO/);
  });

  it('rejects a conservation violation', async () => {
    await expect(
      signVtxoReceipt(operator(), receipt(), { outputs, root, epoch: 1, inputsAmount: 100n }),
    ).rejects.toThrow(/conservation/);
  });

  it('rejects an unsigned receipt', async () => {
    expect(await verifyVtxoReceipt(operator(), receipt(), root)).toBe(false);
  });
});
