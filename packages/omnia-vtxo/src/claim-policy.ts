/**
 * Opt-in VTXO claim policies (M8–M10).
 *
 * The base OmniaVtxo is single-owner. These policies let a VTXO carry a
 * threshold, conditional (HTLC-style) or DvP-bound claim rule. Signatures are
 * assumed to have been cryptographically verified by the caller; this module
 * enforces the authorization *policy* (who/what may claim, and when).
 *
 * `verifyClaimPolicy` is the pure authorization evaluator and may be used
 * offline. `verifyVtxoClaim` is the authoritative entry point: it requires
 * cryptographic signatures over the canonical claim preimage and uses the
 * *verified* signer identities for policy evaluation (OMN-007). A bare
 * `witness.signers` name list is never treated as authorization.
 */

import { HTLCHelper, hexToBytes } from '@totemsdk/core';
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
      /**
       * Total vesting allocation. **Migration note (OMN-008):** this field is
       * optional so existing policies keep type-checking. When omitted the
       * allocation is taken from `ctx.totalAmount` (and, on the authoritative
       * `verifyVtxoClaim` path, defaults to the VTXO amount). Evaluation fails
       * closed when no total is available.
       */
      totalAmount?: bigint;
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
  /**
   * Claimed signer identities. On the pure `verifyClaimPolicy` path these are
   * the (already verified) signer set. On the authoritative `verifyVtxoClaim`
   * path they are only checked for consistency with `signatures`: every name
   * here must have a verified signature (OMN-007).
   */
  signers: string[];
  /**
   * Cryptographic signatures over `computeVtxoClaimPreimage(vtxo, witness, ctx, signer)`.
   * Required by `verifyVtxoClaim`; a name list alone is not authorization.
   */
  signatures?: VtxoClaimSignature[];
  preimage?: string;
  /** 'claim' (before timeout) or 'refund' (after timeout). */
  path?: 'claim' | 'refund';
  /** Delegated policy scope being exercised. */
  scope?: 'claim' | 'transfer';
  /** Vesting claim amount. */
  claimAmount?: bigint;
}

/** One claimed signer signature. Hex strings (with or without `0x`). */
export interface VtxoClaimSignature {
  /** The identity the signature is attributed to (owner, delegate, guardian, …). */
  signer: string;
  /** Signature over the canonical claim preimage. */
  signature: string;
  /** Optional verification key material (e.g. a WOTS public key). */
  publicKey?: string;
}

export interface VtxoClaimSignatureProof {
  signer: string;
  preimage: Uint8Array;
  signature: Uint8Array;
  publicKey?: Uint8Array;
}

/** Caller-supplied primitive that verifies one signature over the preimage. */
export type VtxoClaimSignatureVerifier = (
  proof: VtxoClaimSignatureProof,
) => boolean | Promise<boolean>;

/**
 * The verifier is the trust boundary: it MUST resolve `signer` to the trusted
 * key/address itself (or check that a supplied `publicKey` derives to
 * `signer`). `publicKey` comes from the untrusted witness and must never be
 * accepted merely because it verifies its own signature.
 */

export interface VerifyVtxoClaimOptions {
  /** Cryptographic verifier. Required — there is no default trust anchor. */
  verifySignature: VtxoClaimSignatureVerifier;
  /**
   * Authoritative chain tip. When provided, a claim context block above the
   * tip is rejected, so the caller cannot pick a favourable future block.
   */
  chainTip?: number;
}

export interface VtxoClaimContext {
  block: number;
  poolId?: string;
  tokenId?: string;
  htlc?: { paymentId: string; hashlock: string; status: 'pending' | 'fulfilled' | 'timed_out' };
  /** Total allocation for vesting policies that do not carry `totalAmount`. */
  totalAmount?: bigint;
}

export interface VtxoVestingSchedule {
  startBlock: number;
  cliffBlock: number;
  endBlock: number;
  totalAmount: bigint;
  /** The maximum claimable amount at the evaluated block (floor, never rounded up). */
  vestedAmount: bigint;
}

export interface VtxoClaimResult {
  valid: boolean;
  error?: string;
  /** Vesting schedule details (vesting policies only). */
  schedule?: VtxoVestingSchedule;
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

      const claim = witness.claimAmount;
      if (claim === undefined || claim <= 0n) {
        return { valid: false, error: 'claimAmount required and must be positive' };
      }

      const total = policy.totalAmount ?? ctx.totalAmount;
      if (total === undefined) {
        return {
          valid: false,
          error: 'vesting total amount required (policy.totalAmount or ctx.totalAmount)',
        };
      }
      if (total <= 0n) return { valid: false, error: 'vesting total amount must be positive' };

      const span = policy.endBlock - policy.startBlock;
      if (span <= 0) return { valid: false, error: 'invalid vesting schedule: endBlock must be after startBlock' };
      if (policy.cliffBlock < policy.startBlock || policy.cliffBlock > policy.endBlock) {
        return { valid: false, error: 'invalid vesting schedule: cliffBlock outside [startBlock, endBlock]' };
      }

      // Linear vesting with a cliff: nothing before the cliff, then floor(
      // total * elapsed / span) up to the full amount at/after endBlock.
      // Integer division floors, so the vested amount is never rounded up.
      let vested: bigint;
      if (ctx.block >= policy.endBlock) {
        vested = total;
      } else {
        const elapsed = BigInt(ctx.block - policy.startBlock);
        vested = elapsed <= 0n ? 0n : (total * elapsed) / BigInt(span);
      }
      if (claim > vested) {
        return {
          valid: false,
          error: `claimAmount ${claim} exceeds vested amount ${vested} at block ${ctx.block}`,
        };
      }

      return {
        valid: true,
        schedule: {
          startBlock: policy.startBlock,
          cliffBlock: policy.cliffBlock,
          endBlock: policy.endBlock,
          totalAmount: total,
          vestedAmount: vested,
        },
      };
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

/** Domain separator for the canonical claim preimage. */
export const VTXO_CLAIM_PREIMAGE_DOMAIN = 'totemsdk/omnia-vtxo/claim/v1';

/**
 * The canonical bytes a claimant must sign. Binds the VTXO identity, the
 * claimed signer, the policy context (block, path, scope, HTLC, preimage) and
 * the vesting amount so a signature cannot be replayed in another context.
 */
export function computeVtxoClaimPreimage(
  vtxo: Pick<OmniaVtxo, 'vtxoId' | 'poolId' | 'tokenId' | 'amount' | 'owner'>,
  witness: VtxoClaimWitness,
  ctx: VtxoClaimContext,
  signer: string,
): Uint8Array {
  const canonical = [
    VTXO_CLAIM_PREIMAGE_DOMAIN,
    vtxo.poolId,
    vtxo.vtxoId,
    vtxo.tokenId,
    vtxo.amount.toString(),
    vtxo.owner,
    signer,
    ctx.block.toString(),
    witness.claimAmount !== undefined ? witness.claimAmount.toString() : '',
    witness.path ?? '',
    witness.scope ?? '',
    ctx.htlc?.paymentId ?? '',
    ctx.htlc?.hashlock ?? '',
    ctx.htlc?.status ?? '',
    witness.preimage ?? '',
  ].join('|');
  return new TextEncoder().encode(canonical);
}

function decodeHex(value: string): Uint8Array {
  try {
    return hexToBytes(value);
  } catch {
    return new Uint8Array(0);
  }
}

/**
 * Verify every supplied signature over its canonical claim preimage and return
 * the identities actually backed by a valid signature.
 *
 * This is deliberately separate from {@link verifyClaimPolicy}: the policy
 * decides *who* may claim; this decides *whether they proved it*.
 */
export async function verifyVtxoClaimSignatures(
  vtxo: Pick<OmniaVtxo, 'vtxoId' | 'poolId' | 'tokenId' | 'amount' | 'owner'>,
  witness: VtxoClaimWitness,
  ctx: VtxoClaimContext,
  verifySignature: VtxoClaimSignatureVerifier,
): Promise<{ valid: boolean; signers: string[]; errors: string[] }> {
  const signatures = witness.signatures ?? [];
  if (signatures.length === 0) {
    return {
      valid: false,
      signers: [],
      errors: ['claim requires cryptographic signatures over the claim preimage (a signer name list is not authorization)'],
    };
  }

  const signers: string[] = [];
  const errors: string[] = [];
  for (const entry of signatures) {
    if (!entry.signer) {
      errors.push('signature entry is missing a signer');
      continue;
    }
    const signature = decodeHex(entry.signature ?? '');
    if (signature.length === 0) {
      errors.push(`signature entry for ${entry.signer} is empty or not hex`);
      continue;
    }
    const preimage = computeVtxoClaimPreimage(vtxo, witness, ctx, entry.signer);
    let ok = false;
    try {
      ok = await verifySignature({
        signer: entry.signer,
        preimage,
        signature,
        publicKey: entry.publicKey !== undefined ? decodeHex(entry.publicKey) : undefined,
      });
    } catch (err) {
      errors.push(`signature verification failed for ${entry.signer}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
    if (!ok) {
      errors.push(`invalid claim signature for ${entry.signer}`);
      continue;
    }
    signers.push(entry.signer);
  }

  return { valid: errors.length === 0, signers: [...new Set(signers)], errors };
}

/**
 * Authoritative claim verification.
 *
 * Requires cryptographic signature proof for the claimed signer(s) — a bare
 * `witness.signers` list is rejected. The policy is then evaluated with only
 * the verified signer identities. Callers must supply a real signature
 * verifier (e.g. WOTS verification against the signer's public key) and, on
 * the authoritative path, the chain tip so a caller-chosen future block is
 * rejected (OMN-007).
 */
export async function verifyVtxoClaim(
  vtxo: OmniaVtxo,
  witness: VtxoClaimWitness,
  ctx: VtxoClaimContext,
  options: VerifyVtxoClaimOptions,
): Promise<VtxoClaimResult> {
  if (!options || typeof options.verifySignature !== 'function') {
    return { valid: false, error: 'claim verification requires a signature verifier' };
  }
  if (!Number.isInteger(ctx.block) || ctx.block < 0) {
    return { valid: false, error: `invalid claim block ${ctx.block}` };
  }
  if (options.chainTip !== undefined) {
    if (!Number.isInteger(options.chainTip) || options.chainTip < 0) {
      return { valid: false, error: `invalid chain tip ${options.chainTip}` };
    }
    if (ctx.block > options.chainTip) {
      return {
        valid: false,
        error: `claim block ${ctx.block} is ahead of the chain tip ${options.chainTip}`,
      };
    }
  }

  const signatureCheck = await verifyVtxoClaimSignatures(
    vtxo,
    witness,
    ctx,
    options.verifySignature,
  );
  if (!signatureCheck.valid) {
    return { valid: false, error: signatureCheck.errors.join('; ') };
  }

  const claimed = witness.signers ?? [];
  const unverified = claimed.filter((signer) => !signatureCheck.signers.includes(signer));
  if (unverified.length > 0) {
    return {
      valid: false,
      error: `unverified signers: ${unverified.join(', ')}`,
      verifiedSigners: signatureCheck.signers,
    };
  }

  const policyResult = verifyClaimPolicy(
    claimPolicyOf(vtxo),
    { ...witness, signers: signatureCheck.signers },
    { ...ctx, totalAmount: ctx.totalAmount ?? vtxo.amount },
  );

  return { ...policyResult, verifiedSigners: signatureCheck.signers };
}
