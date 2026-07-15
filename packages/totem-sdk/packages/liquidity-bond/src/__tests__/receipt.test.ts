import { issueLiquidityReceipt, computeLiquidityReceiptHash, verifyLiquidityReceipt } from '../receipt.js';
import { createLiquidityPosition } from '../position.js';
import { createLiquidityCommitment } from '../commitment.js';

function makePosition() {
  const commitment = createLiquidityCommitment({
    poolId: 'pool-1', lpAddress: 'MxLP', asset: 'MINIMA', amount: 1000n,
    purpose: 'omnia-router-liquidity', terms: { lockType: 'none' },
  });
  return createLiquidityPosition({ commitment, poolId: 'pool-1' });
}

describe('receipt', () => {
  describe('issueLiquidityReceipt', () => {
    it('issues a receipt', () => {
      const pos = makePosition();
      const receipt = issueLiquidityReceipt({ position: pos, poolId: 'pool-1', ownerAddress: 'MxLP' });
      expect(receipt.ownerAddress).toBe('MxLP');
      expect(receipt.amount).toBe(1000n);
      expect(receipt.receiptHash).toBeDefined();
    });
  });

  describe('computeLiquidityReceiptHash', () => {
    it('computes deterministic hash for same receipt', () => {
      const pos = makePosition();
      const receipt = issueLiquidityReceipt({ position: pos, poolId: 'pool-1', ownerAddress: 'MxLP', issuedAt: 1000 });
      const h1 = computeLiquidityReceiptHash(receipt);
      const h2 = computeLiquidityReceiptHash(receipt);
      expect(h1).toBe(h2);
    });
  });

  describe('verifyLiquidityReceipt', () => {
    it('verifies a valid receipt', () => {
      const pos = makePosition();
      const receipt = issueLiquidityReceipt({ position: pos, poolId: 'pool-1', ownerAddress: 'MxLP' });
      const result = verifyLiquidityReceipt({ receipt, position: pos });
      expect(result.ok).toBe(true);
    });

    it('rejects receipt with wrong owner', () => {
      const pos = makePosition();
      const receipt = issueLiquidityReceipt({ position: pos, poolId: 'pool-1', ownerAddress: 'MxAttacker' });
      const result = verifyLiquidityReceipt({ receipt, position: pos });
      expect(result.ok).toBe(false);
      expect(result.code).toBe('RECEIPT_OWNER_NOT_AUTHORISED');
    });
  });
});
