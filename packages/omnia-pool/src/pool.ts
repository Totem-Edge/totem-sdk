/**
 * omnia-pool/pool.ts — Pool lifecycle primitives.
 *
 * Creates and registers a pool manifest in a liquidity-bond registry.
 */

import {
  createLiquidityPoolManifest,
  registerLiquidityPool,
  type CreateLiquidityPoolManifestParams,
  type LiquidityBondRegistryState,
  type LiquidityPoolManifest,
} from '@totemsdk/liquidity-bond';
import type { CreateOmniaPoolParams, OmniaPool, OmniaPoolDeploymentContext } from './types.js';

/**
 * Create an Omnia-style liquidity pool manifest and register it in a registry.
 */
export function createOmniaPool(
  params: CreateOmniaPoolParams,
  state: LiquidityBondRegistryState,
): OmniaPool {
  const manifestParams: CreateLiquidityPoolManifestParams = {
    poolId: params.poolId,
    poolType: params.poolType,
    purpose: params.purpose,
    asset: params.tokenId,
    operatorAddress: params.operatorAddress,
    totalCapacity: BigInt(params.capacity),
    lockTerms: params.lockTerms ?? { lockType: 'none' },
    feePolicy: params.feePolicy,
    riskPolicy: params.riskPolicy,
    metadata: {
      ...(params.metadata ?? {}),
      omniaPool: true,
    },
  };

  const manifest = createLiquidityPoolManifest(manifestParams);
  const registry = registerLiquidityPool(state, manifest);

  return {
    poolId: params.poolId,
    manifest,
    registry,
    deploymentContext: params.operatorSigner
      ? { signer: params.operatorSigner }
      : undefined,
  };
}

/**
 * Load an existing pool from a registry by poolId.
 */
export function loadOmniaPool(
  poolId: string,
  state: LiquidityBondRegistryState,
): OmniaPool | undefined {
  const manifest = state.pools[poolId];
  if (!manifest) return undefined;
  return { poolId, manifest, registry: state };
}

/**
 * Convenience helper to build a default Omnia pool lock terms.
 */
export function makeOmniaLockTerms(
  minLockMs = 0,
  earlyWithdrawalAllowed = true,
  earlyWithdrawalPenaltyBps = 0,
): NonNullable<CreateOmniaPoolParams['lockTerms']> {
  return {
    lockType: minLockMs > 0 ? 'fixed-duration' : 'none',
    minLockMs,
    earlyWithdrawalAllowed,
    earlyWithdrawalPenaltyBps,
  };
}

/**
 * Convenience helper to build a default Omnia fee policy.
 */
export function makeOmniaFeePolicy(
  lpFeeBps = 50,
  operatorFeeBps = 10,
  feeModel: 'pro-rata' | 'record-only' | 'none' = 'pro-rata',
): NonNullable<CreateOmniaPoolParams['feePolicy']> {
  return {
    feeModel,
    lpFeeBps,
    operatorFeeBps,
  };
}
