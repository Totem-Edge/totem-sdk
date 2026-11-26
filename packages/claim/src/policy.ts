/**
 * Payload-agnostic claim policies.
 *
 * A policy decides *who may claim, when, and under what conditions*. It does
 * not decide what is being claimed (the payload) or how it settles. Bindings to
 * a specific settlement backend (a VTXO pool, for example) belong to the
 * adapter that owns that backend; `evaluateClaim` is deliberately pure.
 *
 * Signatures are assumed to have been cryptographically verified by the caller.
 * This module enforces the authorization *policy*, not signature validity. Use
 * `verifyClaimSignatures` in the settlement adapter for the authoritative path.
 */

import { HTLCHelper } from '@totemsdk/core';
import { computeVestingSchedule, type VestingSchedule } from './vesting.js';

export interface SingleClaimPolicy {
  type: 'single';
  owner: string;
}

export interface ThresholdClaimPolicy {
  type: 'threshold';
  threshold: number;
  owners: string[];
}

export interface ConditionalClaimPolicy {
  type: 'conditional';
  owner: string;
  refundOwner: string;
  hashlock: string;
  timeoutBlock: number;
}

export interface DvpClaimPolicy {
  type: 'dvp';
  owner: string;
  counterparty: string;
  paymentId: string;
  hashlock: string;
  timeoutBlock: number;
}

export interface DelegatedClaimPolicy {
  type: 'delegated';
  owner: string;
  delegate: string;
  scope: 'claim' | 'transfer';
  expiresAtBlock: number;
  revoked?: boolean;
}

export interface RotationClaimPolicy {
  type: 'rotation';
  fromOperator: string;
  toOperator: string;
  rotateAtBlock: number;
}

export interface VestingClaimPolicy {
  type: 'vesting';
  owner: string;
  beneficiary: string;
  startBlock: number;
  cliffBlock: number;
  endBlock: number;
  /**
   * Total vesting allocation. When omitted the amount is taken from
   * `ClaimContext.totalAmount` (and, on the authoritative path, defaults to the
   * claimed asset's amount). Evaluation fails closed when no total is available.
   */
  totalAmount?: bigint;
}

export interface RecoveryClaimPolicy {
  type: 'recovery';
  owner: string;
  guardians: string[];
  threshold: number;
  recoverAfterBlock: number;
}

export interface CollateralClaimPolicy {
  type: 'collateral';
  owner: string;
  counterparty: string;
  releaseAtBlock?: number;
}

export type ClaimPolicy =
  | SingleClaimPolicy
  | ThresholdClaimPolicy
  | ConditionalClaimPolicy
  | DvpClaimPolicy
  | DelegatedClaimPolicy
  | RotationClaimPolicy
  | VestingClaimPolicy
  | RecoveryClaimPolicy
  | CollateralClaimPolicy;

export interface ClaimWitness {
  /**
   * Claimed signer identities. On the pure `evaluateClaim` path these are the
   * (already verified) signer set. On the authoritative path they are only
   * checked for consistency with `signatures`.
   */
  signers: string[];
  /**
   * Cryptographic signatures over a canonical claim preimage. Required by the
   * authoritative verifier; a name list alone is not authorization.
   */
  signatures?: ClaimSignature[];
  preimage?: string;
  /** 'claim' (before timeout) or 'refund' (after timeout). */
  path?: 'claim' | 'refund';
  /** Delegated policy scope being exercised. */
  scope?: 'claim' | 'transfer';
  /** Vesting claim amount. */
  claimAmount?: bigint;
}

/** One claimed signer signature. Hex strings (with or without `0x`). */
export interface ClaimSignature {
  /** The identity the signature is attributed to (owner, delegate, guardian, …). */
  signer: string;
  /** Signature over the canonical claim preimage. */
  signature: string;
  /** Optional verification key material (e.g. a WOTS public key). */
  publicKey?: string;
}

export interface ClaimSignatureProof {
  signer: string;
  preimage: Uint8Array;
  signature: Uint8Array;
  publicKey?: Uint8Array;
}

/** Caller-supplied primitive that verifies one signature over the preimage. */
export type ClaimSignatureVerifier = (
  proof: ClaimSignatureProof,
) => boolean | Promise<boolean>;

export interface VerifyClaimOptions {
  /** Cryptographic verifier. Required — there is no default trust anchor. */
  verifySignature: ClaimSignatureVerifier;
  /**
   * Authoritative chain tip. When provided, a claim context block above the
   * tip is rejected, so the caller cannot pick a favourable future block.
   */
  chainTip?: number;
}

export interface ClaimContext {
  block: number;
  /**
   * Opaque settlement binding hints. `evaluateClaim` ignores them; adapters use
   * them to reject a policy evaluated against the wrong pool or asset.
   */
  poolId?: string;
  tokenId?: string;
  htlc?: { paymentId: string; hashlock: string; status: 'pending' | 'fulfilled' | 'timed_out' };
  /** Total allocation for vesting policies that do not carry `totalAmount`. */
  totalAmount?: bigint;
}

export interface ClaimResult {
  valid: boolean;
  error?: string;
  /** Vesting schedule details (vesting policies only). */
  schedule?: VestingSchedule;
  /** Signer identities backed by a verified signature (authoritative path). */
  verifiedSigners?: string[];
}

function uniqueSigners(signers: string[]): string[] {
  return [...new Set(signers)];
}

function preimageMatches(preimage: string | undefined, hashlock: string): boolean {
  if (!preimage) return false;
  try {
    return HTLCHelper.verifyPreimage(preimage, hashlock, 'sha3');
  } catch {
    return false;
  }
}

/**
 * Pure authorization evaluator. May be used offline.
 *
 * This decides *who may claim* from the signer set and the supplied context. It
 * does not verify signatures and does not check settlement-specific bindings.
 */
export function evaluateClaim(
  policy: ClaimPolicy,
  witness: ClaimWitness,
  ctx: ClaimContext,
): ClaimResult {
  const signers = uniqueSigners(witness.signers);

  switch (policy.type) {
    case 'single':
      return signers.includes(policy.owner)
        ? { valid: true }
        : { valid: false, error: `claim requires owner ${policy.owner}` };

    case 'threshold': {
      if (!Number.isInteger(policy.threshold) || policy.threshold <= 0) {
        return { valid: false, error: 'threshold must be positive' };
      }
      if (policy.threshold > policy.owners.length) {
        return { valid: false, error: 'threshold exceeds owner set' };
      }
      const approved = signers.filter((s) => policy.owners.includes(s));
      return approved.length >= policy.threshold
        ? { valid: true }
        : { valid: false, error: `threshold ${policy.threshold}/${policy.owners.length} not met` };
    }

    case 'conditional': {
      if (ctx.block <= policy.timeoutBlock) {
        if (witness.path !== 'claim') return { valid: false, error: 'claim path required before timeout' };
        if (!signers.includes(policy.owner)) return { valid: false, error: 'owner signature required' };
        if (!preimageMatches(witness.preimage, policy.hashlock)) {
          return { valid: false, error: 'invalid preimage' };
        }
        return { valid: true };
      }
      if (witness.path !== 'refund') return { valid: false, error: 'refund path required after timeout' };
      if (!signers.includes(policy.refundOwner)) return { valid: false, error: 'refund owner signature required' };
      return { valid: true };
    }

    case 'delegated': {
      if (policy.revoked) return { valid: false, error: 'delegation revoked' };
      if (ctx.block > policy.expiresAtBlock) return { valid: false, error: 'delegation expired' };
      if (witness.scope !== policy.scope) return { valid: false, error: `scope must be ${policy.scope}` };
      return signers.includes(policy.delegate)
        ? { valid: true }
        : { valid: false, error: 'delegate signature required' };
    }

    case 'rotation':
      return signers.includes(ctx.block >= policy.rotateAtBlock ? policy.toOperator : policy.fromOperator)
        ? { valid: true }
        : { valid: false, error: 'wrong operator for epoch' };

    case 'vesting': {
      if (!signers.includes(policy.beneficiary)) return { valid: false, error: 'beneficiary signature required' };
      if (ctx.block < policy.cliffBlock) return { valid: false, error: 'vesting cliff not reached' };

      const claim = witness.claimAmount;
      if (claim === undefined || claim <= 0n) {
        return { valid: false, error: 'claimAmount required and must be positive' };
      }

      const schedule = computeVestingSchedule(policy, ctx.block, ctx.totalAmount);
      if (!schedule.valid) return { valid: false, error: schedule.error };

      if (claim > schedule.schedule.vestedAmount) {
        return {
          valid: false,
          error: `claimAmount ${claim} exceeds vested amount ${schedule.schedule.vestedAmount} at block ${ctx.block}`,
        };
      }

      return { valid: true, schedule: schedule.schedule };
    }

    case 'recovery': {
      if (ctx.block < policy.recoverAfterBlock) return { valid: false, error: 'recovery window not open' };
      const approved = signers.filter((s) => policy.guardians.includes(s));
      return approved.length >= policy.threshold
        ? { valid: true }
        : { valid: false, error: `guardian threshold ${policy.threshold} not met` };
    }

    case 'collateral': {
      if (policy.releaseAtBlock !== undefined && ctx.block < policy.releaseAtBlock) {
        return { valid: false, error: 'collateral release not reached' };
      }
      if (!signers.includes(policy.owner) || !signers.includes(policy.counterparty)) {
        return { valid: false, error: 'both collateral parties must authorize' };
      }
      return { valid: true };
    }

    case 'dvp': {
      if (!ctx.htlc) return { valid: false, error: 'DvP requires the bound HTLC' };
      if (ctx.htlc.paymentId !== policy.paymentId) return { valid: false, error: 'HTLC payment id mismatch' };
      if (ctx.htlc.hashlock !== policy.hashlock) return { valid: false, error: 'HTLC hashlock mismatch' };
      if (ctx.htlc.status !== 'pending' && ctx.htlc.status !== 'fulfilled') {
        return { valid: false, error: `HTLC is ${ctx.htlc.status}` };
      }
      if (!signers.includes(policy.owner) || !signers.includes(policy.counterparty)) {
        return { valid: false, error: 'both DvP parties must authorize' };
      }
      if (!preimageMatches(witness.preimage, policy.hashlock)) {
        return { valid: false, error: 'invalid DvP preimage' };
      }
      return { valid: true };
    }
  }
}
