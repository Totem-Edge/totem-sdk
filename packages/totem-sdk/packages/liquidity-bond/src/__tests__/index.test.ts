import * as lb from '../index.js';

describe('index', () => {
  const EXPECTED_EXPORTS = [
    'createLiquidityPoolManifest', 'computeLiquidityPoolManifestHash', 'verifyLiquidityPoolManifest',
    'verifyPoolOperatorIdentity', 'verifyLpIdentity', 'verifyReceiptOwnerIdentity',
    'createLiquidityCommitment', 'acceptLiquidityCommitment', 'rejectLiquidityCommitment', 'cancelLiquidityCommitment', 'verifyLiquidityCommitment',
    'createLiquidityPosition', 'activateLiquidityPosition', 'markLiquidityPositionDepleted', 'markLiquidityPositionInvalid',
    'computeAvailableLiquidity', 'computeEffectiveLiquidityAmount', 'verifyLiquidityPosition',
    'issueLiquidityReceipt', 'computeLiquidityReceiptHash', 'verifyLiquidityReceipt',
    'createLiquidityAllocation', 'releaseLiquidityAllocation', 'markAllocationDepleted', 'verifyLiquidityAllocation', 'sumActiveAllocations',
    'recordLiquidityFee', 'sumFeesForPosition', 'sumLpFeesForPosition', 'verifyLiquidityFeeRecord',
    'createWithdrawalIntent', 'approveWithdrawalIntent', 'rejectWithdrawalIntent', 'cancelWithdrawalIntent', 'verifyWithdrawalAllowed',
    'applyLiquidityHaircut', 'computePositionRiskScore', 'computePoolUtilisation', 'detectDoubleCountedLiquidity',
    'validateLiquidityAgainstPolicy', 'filterLiquidityPositionsByPolicy', 'rankLiquidityPositionsByRisk',
    'createEmptyLiquidityBondRegistryState', 'registerLiquidityPool', 'registerLiquidityCommitment', 'registerLiquidityPosition',
    'attachLiquidityReceipt', 'attachLiquidityAllocation', 'attachLiquidityFeeRecord', 'attachWithdrawalIntent',
    'getLiquidityPool', 'getLiquidityPosition', 'getLiquidityReceipt',
    'listLiquidityPools', 'listPositionsByPool', 'listPositionsByLp', 'listActivePositions', 'listWithdrawablePositions',
    'MemoryLiquidityBondStore',
    'serializeLiquidityBondState', 'parseLiquidityBondState',
    'LiquidityBondError', 'LiquidityPoolManifestError', 'LiquidityPositionError', 'LiquidityReceiptError', 'LiquidityPolicyError',
  ];

  it('exports all expected symbols', () => {
    for (const name of EXPECTED_EXPORTS) {
      const val = (lb as Record<string, unknown>)[name];
      if (val === undefined) throw new Error(`Missing export: ${name}`);
      expect(val).toBeDefined();
    }
  });

  it('package imports correctly', () => {
    expect(lb.createLiquidityPoolManifest).toBeInstanceOf(Function);
    expect(lb.MemoryLiquidityBondStore).toBeDefined();
  });
});
