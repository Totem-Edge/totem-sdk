/**
 * VTXO claim policies (M8–M18), bound to a pool and a token.
 *
 * The generic policy union and the pure authorization evaluator live in
 * `@totemsdk/claim`. This module adds the VTXO-specific pieces:
 *
 *   - the pool/token binding check,
 *   - the canonical VTXO claim preimage,
 *   - authoritative signature verification against that preimage.
 *
 * Keeping the generic semantics in `@totemsdk/claim` means a non-VTXO claim
 * (an NFT, a proof, a mandate) can use the same policies without importing the
 * VTXO package or its channel/exit dependency graph.
 */

import type {
  ClaimContext,
  ClaimPolicy,
  ClaimResult,
  ClaimSignature,
  ClaimSignatureProof,
  ClaimSignatureVerifier,
  ClaimWitness,
  VerifyClaimOptions,
  VestingSchedule,
} from '@totemsdk/claim';
import { evaluateClaim } from '@totemsdk/claim';
import { hexToBytes } from '@totemsdk/core';
import type { OmniaVtxo } from './types.js';

export type {
  ClaimContext,
  ClaimPolicy,
  ClaimResult,
  ClaimSignature,
  ClaimSignatureProof,
  ClaimSignatureVerifier,
  ClaimWitness,
  VerifyClaimOptions,
  VestingSchedule,
} from '@totemsdk/claim';

export interface VtxoPolicyBinding {
  poolId?: string;
  tokenId?: string;
}

/** A generic claim policy plus an optional VTXO pool/token binding. */
export type VtxoClaimPolicy = ClaimPolicy & { binding?: VtxoPolicyBinding };

export type VtxoClaimWitness = ClaimWitness;
export type VtxoClaimSignature = ClaimSignature;
export type VtxoClaimSignatureProof = ClaimSignatureProof;
export type VtxoClaimSignatureVerifier = ClaimSignatureVerifier;
export type VerifyVtxoClaimOptions = VerifyClaimOptions;
export type VtxoClaimContext = ClaimContext;
export type VtxoVestingSchedule = VestingSchedule;
export type VtxoClaimResult = ClaimResult;

/**
 * Verify the VTXO binding, then evaluate the pure claim policy.
 *
 * Binding is deliberately enforced here, not in `@totemsdk/claim`: a policy
 * bound to `poolId`/`tokenId` must not be evaluated against another pool or
 * asset. The generic evaluator knows nothing about VTXO pools.
 */
export function verifyClaimPolicy(
  policy: VtxoClaimPolicy,
  witness: VtxoClaimWitness,
  ctx: VtxoClaimContext,
): VtxoClaimResult {
  if (policy.binding?.poolId !== undefined && policy.binding.poolId !== ctx.poolId) {
    return { valid: false, error: 'policy pool binding mismatch' };
  }
  if (policy.binding?.tokenId !== undefined && policy.binding.tokenId !== ctx.tokenId) {
    return { valid: false, error: 'policy token binding mismatch' };
  }
  return evaluateClaim(policy, witness, ctx);
}

/** Resolve the policy attached to a VTXO, defaulting to its single owner. */
export function claimPolicyOf(vtxo: OmniaVtxo): VtxoClaimPolicy {
  return (vtxo as OmniaVtxo & { claimPolicy?: VtxoClaimPolicy }).claimPolicy
    ?? { type: 'single', owner: vtxo.owner };
}

/** Domain separator for the canonical VTXO claim preimage. */
export const VTXO_CLAIM_PREIMAGE_DOMAIN = 'totemsdk/vtxo/claim/v1';

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
