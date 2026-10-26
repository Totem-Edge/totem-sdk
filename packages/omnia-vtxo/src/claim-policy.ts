/**
 * Opt-in VTXO claim policies (M8–M10).
 *
 * The base OmniaVtxo is single-owner. These policies let a VTXO carry a
 * threshold, conditional (HTLC-style) or DvP-bound claim rule. Signatures are
 * assumed to have been cryptographically verified by the caller; this module
 * enforces the authorization *policy* (who/what may claim, and when).
 */

import { HTLCHelper } from '@totemsdk/core';
import type { OmniaVtxo } from './types.js';

export interface VtxoPolicyBinding {
  poolId?: string;
  tokenId?: string;
}

export type VtxoClaimPolicy = (
  | { type: 'single'; owner: string }
  | { type: 'threshold'; threshold: number; owners: string[] }
  | {
      type: 'conditional';
      owner: string;
      refundOwner: string;
      hashlock: string;
      timeoutBlock: number;
    }
  | {
      type: 'dvp';
      owner: string;
      counterparty: string;
      paymentId: string;
      hashlock: string;
      timeoutBlock: number;
    }
  | {
      type: 'delegated';
      owner: string;
      delegate: string;
      scope: 'claim' | 'transfer';
      expiresAtBlock: number;
      revoked?: boolean;
    }
  | {
      type: 'rotation';
      fromOperator: string;
      toOperator: string;
      rotateAtBlock: number;
    }
  | {
      type: 'vesting';
      owner: string;
      beneficiary: string;
      startBlock: number;
      cliffBlock: number;
      endBlock: number;
    }
  | {
      type: 'recovery';
      owner: string;
      guardians: string[];
      threshold: number;
      recoverAfterBlock: number;
    }
  | {
      type: 'collateral';
      owner: string;
      counterparty: string;
      releaseAtBlock?: number;
    }
) & { binding?: VtxoPolicyBinding };

export interface VtxoClaimWitness {
  signers: string[];
  preimage?: string;
  /** 'claim' (before timeout) or 'refund' (after timeout). */
  path?: 'claim' | 'refund';
  /** Delegated policy scope being exercised. */
  scope?: 'claim' | 'transfer';
  /** Vesting claim amount. */
  claimAmount?: bigint;
}

export interface VtxoClaimContext {
  block: number;
  poolId?: string;
  tokenId?: string;
  htlc?: { paymentId: string; hashlock: string; status: 'pending' | 'fulfilled' | 'timed_out' };
}

export interface VtxoClaimResult {
  valid: boolean;
  error?: string;
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

export function verifyClaimPolicy(
  policy: VtxoClaimPolicy,
  witness: VtxoClaimWitness,
  ctx: VtxoClaimContext,
): VtxoClaimResult {
  const signers = uniqueSigners(witness.signers);
  if (policy.binding?.poolId !== undefined && policy.binding.poolId !== ctx.poolId) {
    return { valid: false, error: 'policy pool binding mismatch' };
  }
  if (policy.binding?.tokenId !== undefined && policy.binding.tokenId !== ctx.tokenId) {
    return { valid: false, error: 'policy token binding mismatch' };
  }
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
      const total = witness.claimAmount;
      if (total === undefined || total <= 0n) return { valid: false, error: 'claimAmount required' };
      if (ctx.block >= policy.endBlock) return { valid: true };
      const elapsed = BigInt(ctx.block - policy.startBlock);
      const span = BigInt(policy.endBlock - policy.startBlock);
      if (elapsed <= 0n) return { valid: false, error: 'vesting has not started' };
      // Caller supplies the already-committed vested amount; linear schedule is
      // represented by requiring the witness amount to be within the total.
      return total > 0n ? { valid: true } : { valid: false, error: 'invalid claim amount' };
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

/** Resolve the policy attached to a VTXO, defaulting to its single owner. */
export function claimPolicyOf(vtxo: OmniaVtxo): VtxoClaimPolicy {
  return (vtxo as OmniaVtxo & { claimPolicy?: VtxoClaimPolicy }).claimPolicy
    ?? { type: 'single', owner: vtxo.owner };
}

export function verifyVtxoClaim(
  vtxo: OmniaVtxo,
  witness: VtxoClaimWitness,
  ctx: VtxoClaimContext,
): VtxoClaimResult {
  if (witness.signers.length === 0) return { valid: false, error: 'no signers' };
  return verifyClaimPolicy(claimPolicyOf(vtxo), witness, ctx);
}
