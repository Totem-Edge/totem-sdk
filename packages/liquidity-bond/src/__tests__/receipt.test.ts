import { issueLiquidityReceipt, computeLiquidityReceiptHash, verifyLiquidityReceipt, consumeLiquidityReceipt, RECEIPT_HASH_DOMAIN } from '../receipt.js';
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
    it('issues a receipt with a per-position nonce', () => {
      const pos = makePosition();
      const receipt = issueLiquidityReceipt({ position: pos, poolId: 'pool-1', ownerAddress: 'MxLP' });
      expect(receipt.ownerAddress).toBe('MxLP');
      expect(receipt.amount).toBe(1000n);
      expect(receipt.receiptHash).toBeDefined();
      expect(receipt.nonce).toBeDefined();
      expect(receipt.consumedAt).toBeUndefined();
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

    it('is domain-separated so a hash cannot replay across records', () => {
      const pos = makePosition();
      const receipt = issueLiquidityReceipt({ position: pos, poolId: 'pool-1', ownerAddress: 'MxLP', issuedAt: 1000 });
      const h = computeLiquidityReceiptHash(receipt);
      expect(h).not.toBe(computeLiquidityReceiptHash({ ...receipt, positionId: 'pos-other' }));
      expect(RECEIPT_HASH_DOMAIN).toMatch(/^totemsdk\/liquidity-bond\/receipt\/v1$/);
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

    it('rejects a consumed (replayed) receipt', () => {
      const pos = makePosition();
      const receipt = issueLiquidityReceipt({ position: pos, poolId: 'pool-1', ownerAddress: 'MxLP' });
      const consumed = consumeLiquidityReceipt(receipt, 'wdrw-1');
      const result = verifyLiquidityReceipt({ receipt: consumed, position: pos });
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/already been consumed/);
    });
  });

  describe('consumeLiquidityReceipt', () => {
    it('single-spends a receipt and refuses a second consume', () => {
      const pos = makePosition();
      const receipt = issueLiquidityReceipt({ position: pos, poolId: 'pool-1', ownerAddress: 'MxLP' });
      const consumed = consumeLiquidityReceipt(receipt, 'wdrw-1', 2000);
      expect(consumed.consumedAt).toBe(2000);
      expect(consumed.consumedIntentId).toBe('wdrw-1');
      expect(() => consumeLiquidityReceipt(consumed, 'wdrw-2')).toThrow(/already been consumed/);
    });
  });
});
