/**
 * RFC-038 V0 — VTXO operator co-signature (real WOTS over the batch commitment).
 */

import { createUnifiedChildTreeKey } from '@totemsdk/core';
import type { WotsLeaseProvider } from '@totemsdk/wots-lease';
import { createVtxoOperator } from '../operator.js';
import { computeBatchCommitment, computeBatchCommitmentBytes } from '../commitment.js';

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

describe('createVtxoOperator (RFC-038 V0)', () => {
  const treeKey = createUnifiedChildTreeKey(new Uint8Array(32).fill(7), 0);

  it('signs a batch commitment and verifies against the operator root', async () => {
    const lp = mockLease();
    const operator = createVtxoOperator({ poolId: 'pool-1', treeKey, leaseProvider: lp });
    expect(operator.publicKey).toMatch(/^0x[0-9a-f]{64}$/);

    const commitment = computeBatchCommitment('pool-1', 1, 'root', ['v1', 'v2']);
    const data = computeBatchCommitmentBytes('pool-1', 1, 'root', ['v1', 'v2']);
    expect(data).toHaveLength(32);
    const signature = await operator.sign(data);
    expect(signature).toBeTruthy();

    expect(await operator.verify(data, signature)).toBe(true);
    expect(await operator.verify(computeBatchCommitmentBytes('pool-1', 1, 'root', ['v1']), signature)).toBe(false);
    expect(lp.commitKeyUse).toHaveBeenCalled();
    expect(lp.burnReservation).not.toHaveBeenCalled();
  });

  it('rejects a malformed signature', async () => {
    const operator = createVtxoOperator({ poolId: 'pool-1', treeKey, leaseProvider: mockLease() });
    expect(await operator.verify(new Uint8Array(32), 'not-a-real-sig')).toBe(false);
  });
});
