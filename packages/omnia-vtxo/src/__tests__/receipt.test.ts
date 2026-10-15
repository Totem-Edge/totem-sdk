/**
 * RFC-038 V0 — VTXO receipt co-signing.
 */

import { createUnifiedChildTreeKey } from '@totemsdk/core';
import type { WotsLeaseProvider } from '@totemsdk/wots-lease';
import { createVtxoOperator } from '../operator.js';
import { signVtxoReceipt, verifyVtxoReceipt } from '../receipt.js';
import type { VtxoOperatorReceipt } from '../types.js';

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

  it('co-signs a receipt and verifies it against the batch root', async () => {
    const operator = createVtxoOperator({ poolId: 'pool-1', treeKey, leaseProvider: mockLease() });
    const signed = await signVtxoReceipt(operator, receipt(), 'root-1');
    expect(signed.signature).toBeTruthy();

    expect(await verifyVtxoReceipt(operator, signed, 'root-1')).toBe(true);
    // a different batch root (or outputs) must not verify
    expect(await verifyVtxoReceipt(operator, signed, 'root-2')).toBe(false);
    expect(await verifyVtxoReceipt(operator, { ...signed, outputIds: ['vX'] }, 'root-1')).toBe(false);
  });

  it('rejects an unsigned receipt', async () => {
    const operator = createVtxoOperator({ poolId: 'pool-1', treeKey, leaseProvider: mockLease() });
    expect(await verifyVtxoReceipt(operator, receipt(), 'root-1')).toBe(false);
  });
});
