import { verifyPoolOperatorIdentity, verifyLpIdentity, verifyReceiptOwnerIdentity } from '../identity.js';
import { createLiquidityPoolManifest } from '../pool-manifest.js';
import { createLiquidityCommitment } from '../commitment.js';
import { issueLiquidityReceipt } from '../receipt.js';
import { createLiquidityPosition } from '../position.js';

function makeIdentityGraph(rootAddress: string) {
  return {
    document: { rootAddress, controllerAddress: rootAddress },
    claims: [],
  };
}

describe('identity', () => {
  describe('verifyPoolOperatorIdentity', () => {
    it('verifies pool operator identity', () => {
      const pool = createLiquidityPoolManifest({
        poolId: 'pool-1', poolType: 'omnia-router', purpose: 'omnia-router-liquidity',
        asset: 'MINIMA', lockTerms: { lockType: 'none' }, operatorAddress: 'MxRoot', createdAt: 1000,
      });
      const result = verifyPoolOperatorIdentity({ manifest: pool, identityGraph: makeIdentityGraph('MxRoot') });
      expect(result.ok).toBe(true);
    });

    it('rejects unauthorised operator', () => {
      const pool = createLiquidityPoolManifest({
        poolId: 'pool-1', poolType: 'omnia-router', purpose: 'omnia-router-liquidity',
        asset: 'MINIMA', lockTerms: { lockType: 'none' }, operatorAddress: 'MxAttacker', createdAt: 1000,
      });
      const result = verifyPoolOperatorIdentity({ manifest: pool, identityGraph: makeIdentityGraph('MxRoot') });
      expect(result.ok).toBe(false);
      expect(result.code).toBe('POOL_IDENTITY_NOT_AUTHORISED');
    });
  });

  describe('verifyLpIdentity', () => {
    it('verifies LP identity', () => {
      const commitment = createLiquidityCommitment({
        poolId: 'pool-1', lpAddress: 'MxRoot', asset: 'MINIMA', amount: 1000n,
        purpose: 'omnia-router-liquidity', terms: { lockType: 'none' },
      });
      const result = verifyLpIdentity({ commitment, identityGraph: makeIdentityGraph('MxRoot') });
      expect(result.ok).toBe(true);
    });

    it('rejects unauthorised LP', () => {
      const commitment = createLiquidityCommitment({
        poolId: 'pool-1', lpAddress: 'MxAttacker', asset: 'MINIMA', amount: 1000n,
        purpose: 'omnia-router-liquidity', terms: { lockType: 'none' },
      });
      const result = verifyLpIdentity({ commitment, identityGraph: makeIdentityGraph('MxRoot') });
      expect(result.ok).toBe(false);
    });
  });

  describe('verifyReceiptOwnerIdentity', () => {
    it('rejects unauthorised receipt owner', () => {
      const commitment = createLiquidityCommitment({
        poolId: 'pool-1', lpAddress: 'MxRoot', asset: 'MINIMA', amount: 1000n,
        purpose: 'omnia-router-liquidity', terms: { lockType: 'none' },
      });
      const position = createLiquidityPosition({ commitment, poolId: 'pool-1' });
      const receipt = issueLiquidityReceipt({ position, poolId: 'pool-1', ownerAddress: 'MxAttacker' });
      const result = verifyReceiptOwnerIdentity({ receipt, identityGraph: makeIdentityGraph('MxRoot') });
      expect(result.ok).toBe(false);
      expect(result.code).toBe('RECEIPT_OWNER_NOT_AUTHORISED');
    });
  });
});
