/**
 * omnia-pool/deposit.ts — LP commitment and deposit primitives.
 *
 * The load-bearing rule (#15/#16/#17): a deposit is only ever accepted once its
 * funding is chain-confirmed. `commitToPool` records the funding as `declared`;
 * `acceptCommitment` runs the on-chain check and REFUSES to accept a commitment
 * that is not chain-confirmed. `depositToPool` gates every stage on that fact
 * and returns an anchored signed transition of the registry.
 */

import {
  acceptLiquidityCommitment,
  activateLiquidityPosition,
  assetToTokenId,
  confirmLiquidityCommitment,
  createLiquidityCommitment,
  createLiquidityPosition,
  issueLiquidityReceipt,
  registerLiquidityCommitment,
  registerLiquidityPosition,
  attachLiquidityReceipt,
  computeEffectiveLiquidityAmount,
  verifyLiquidityCommitment,
  type CreateLiquidityCommitmentParams,
  type LiquidityBondRegistryState,
  type LiquidityCommitment,
  type LiquidityFunding,
  type LiquidityPosition,
  type LiquidityPoolManifest,
  type LiquidityPurpose,
  type RegistrySignedTransition,
} from '@totemsdk/liquidity-bond';
import type {
  DepositToPoolResult,
  OmniaPoolDeploymentContext,
  RegistryRootingContext,
} from './types.js';
import { maybeSignTransition } from './rooting.js';

export interface CommitToPoolParams {
  pool: LiquidityPoolManifest;
  lpAddress: string;
  amount: string;
  purpose: LiquidityPurpose;
  lpIdentityId?: string;
  expiresAt?: number;
  /** The real coin (utxo) the LP claims as funding — never a free-form string. */
  underlyingUtxoRef?: string;
  txpowId?: string;
  metadata?: Record<string, unknown>;
}

export interface AcceptCommitmentParams {
  commitment: LiquidityCommitment;
  pool: LiquidityPoolManifest;
  registry: LiquidityBondRegistryState;
  /** Required: the on-chain funding verifier that gates acceptance. */
  chainProvider: OmniaPoolDeploymentContext['fundingVerifier'] & object;
}

export interface DepositToPoolParams {
  pool: LiquidityPoolManifest;
  lpAddress: string;
  amount: string;
  purpose: LiquidityPurpose;
  lpIdentityId?: string;
  /** The coin that funds the deposit on-chain (deep proof when combined with tx-builder). */
  underlyingUtxoRef?: string;
  txpowId?: string;
  underlyingRefs?: {
    omniaChannelId?: string;
    factoryId?: string;
    routerId?: string;
    vtxoPoolId?: string;
  };
  chainProvider?: OmniaPoolDeploymentContext['fundingVerifier'] & object;
  rooting?: RegistryRootingContext;
  metadata?: Record<string, unknown>;
}

/**
 * Create a signed LP commitment carrying the funding coin as `declared`.
 * Nothing here is trusted on-chain — acceptance is what proves it.
 */
export function commitToPool(params: CommitToPoolParams): { commitment: LiquidityCommitment } {
  const amount = BigInt(params.amount);
  const funding: LiquidityFunding | undefined = params.underlyingUtxoRef
    ? {
        utxoRef: params.underlyingUtxoRef,
        tokenId: assetToTokenId(params.pool.asset),
        amount,
        status: 'declared',
        txpowId: params.txpowId,
      }
    : undefined;
  const createParams: CreateLiquidityCommitmentParams = {
    poolId: params.pool.poolId,
    lpAddress: params.lpAddress,
    lpIdentityId: params.lpIdentityId,
    asset: params.pool.asset,
    amount,
    purpose: params.purpose,
    terms: params.pool.lockTerms,
    expiresAt: params.expiresAt,
    funding,
    metadata: params.metadata,
  };
  const commitment = createLiquidityCommitment(createParams);
  return { commitment };
}

/**
 * Accept an LP commitment and register it — only after on-chain verification
 * confirms the funding. Throws when the funding is missing, declared-only, or
 * fails the chain check (an attacker cannot fake an accepted commitment).
 */
export async function acceptCommitment(
  params: AcceptCommitmentParams,
): Promise<{
  commitment: LiquidityCommitment;
  registry: LiquidityBondRegistryState;
}> {
  const { chainProvider } = params;
  if (!chainProvider) {
    throw new Error('acceptCommitment requires a chainProvider to verify funding on-chain');
  }

  const verified = await verifyLiquidityCommitment({
    commitment: params.commitment,
    pool: params.pool,
    chainProvider,
  });
  if (!verified.ok) {
    throw new Error(`commitment not acceptable: ${verified.reason}`);
  }

  const confirmed = await confirmLiquidityCommitment(params.commitment, chainProvider);
  if (confirmed.funding?.status !== 'chain-confirmed') {
    throw new Error('commitment funding failed on-chain confirmation');
  }

  const accepted = await acceptLiquidityCommitment(confirmed, { chainProvider });
  const registry = registerLiquidityCommitment(params.registry, accepted);
  return { commitment: accepted, registry };
}

/**
 * Create and register a `LiquidityPosition` from an accepted (chain-confirmed)
 * commitment. The position derives its amount from the confirmed funding, never
 * from a self-declared number.
 */
export function createPositionFromCommitment(
  commitment: LiquidityCommitment,
  pool: LiquidityPoolManifest,
  registry: LiquidityBondRegistryState,
  underlyingRefs?: DepositToPoolParams['underlyingRefs'],
  metadata?: Record<string, unknown>,
): {
  position: LiquidityPosition;
  registry: LiquidityBondRegistryState;
} {
  const effectiveAmount = computeEffectiveLiquidityAmount(
    { amount: commitment.amount } as LiquidityPosition,
    pool.riskPolicy,
  );
  const position = createLiquidityPosition({
    commitment,
    poolId: pool.poolId,
    ...underlyingRefs,
    funding: commitment.funding,
    metadata,
  });
  // The commitment is chain-confirmed (acceptCommitment gated on it), so the
  // position may transition to active; this re-checks the funding status here.
  const activated = activateLiquidityPosition(position);
  const adjusted: LiquidityPosition = {
    ...activated,
    effectiveAmount,
    availableAmount: effectiveAmount,
  };
  const nextRegistry = registerLiquidityPosition(registry, adjusted);
  return { position: adjusted, registry: nextRegistry };
}

/**
 * Issue a non-custodial LP receipt for a position.
 */
export function issueLpReceipt(
  position: LiquidityPosition,
  pool: LiquidityPoolManifest,
  registry: LiquidityBondRegistryState,
): {
  receipt: import('@totemsdk/liquidity-bond').LiquidityReceipt;
  registry: LiquidityBondRegistryState;
} {
  const receipt = issueLiquidityReceipt({
    position,
    poolId: pool.poolId,
    ownerAddress: position.lpAddress,
    ownerIdentityId: position.lpIdentityId,
  });
  const nextRegistry = attachLiquidityReceipt(registry, receipt);
  const withReceipt: LiquidityPosition = { ...position, receiptId: receipt.receiptId };
  const withReceiptRegistry = registerLiquidityPosition(nextRegistry, withReceipt);
  return { receipt, registry: withReceiptRegistry };
}

/**
 * Full deposit flow: commit (declared funding) → verify on-chain → accept →
 * create position from confirmed funding → issue receipt → anchor the registry
 * transition. Async because acceptance is an on-chain gate.
 */
export async function depositToPool(
  params: DepositToPoolParams,
  registry: LiquidityBondRegistryState,
): Promise<DepositToPoolResult> {
  const { commitment } = commitToPool(params);
  const chainProvider = params.chainProvider;

  if (!chainProvider) {
    throw new Error('depositToPool requires a chainProvider to verify and confirm funding on-chain');
  }

  const { commitment: accepted, registry: acceptedRegistry } = await acceptCommitment({
    commitment,
    pool: params.pool,
    registry,
    chainProvider,
  });

  const { position, registry: positionRegistry } = createPositionFromCommitment(
    accepted,
    params.pool,
    acceptedRegistry,
    params.underlyingRefs,
    params.metadata,
  );

  const { receipt, registry: finalRegistry } = issueLpReceipt(
    position,
    params.pool,
    positionRegistry,
  );

  const signedTransition = await maybeSignTransition(params.rooting, finalRegistry, {
    type: 'deposit',
    poolId: params.pool.poolId,
    positionId: position.positionId,
    commitmentId: accepted.commitmentId,
    receiptId: receipt.receiptId,
    amount: position.amount,
  });

  return {
    poolId: params.pool.poolId,
    pool: params.pool,
    position,
    receipt,
    state: finalRegistry,
    signedTransition,
  };
}

export type { DepositToPoolResult };
export type { RegistrySignedTransition };
