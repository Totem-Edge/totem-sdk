import type {
  BondProofRef,
  BondProofType,
  ProviderBondVerifyResult,
  BondProofVerifier,
  VerifyBondStackParams,
} from './types.js';

const KNOWN_PROOF_TYPES = new Set<BondProofType>([
  'manual',
  'declared',
  'visible-balance',
  'totem-proof',
  'future-live-chain',
]);

/**
 * RFC-020 C4: a bond proof is only meaningful when independently verified.
 * Every proof type (including self-declared `manual`/`declared`) must be
 * verified by the supplied {@link BondProofVerifier}; without one it fails
 * closed rather than asserting an unbacked `ok`.
 */
export async function verifyBondProof(
  proof: BondProofRef,
  verifier?: BondProofVerifier,
): Promise<ProviderBondVerifyResult> {
  if (!KNOWN_PROOF_TYPES.has(proof.proofType)) {
    return { ok: false, reason: `Unsupported proof type: ${proof.proofType}`, code: 'UNSUPPORTED_PROOF_TYPE' };
  }
  if (proof.proofType === 'totem-proof' && !proof.proof) {
    return { ok: false, reason: 'Totem proof is missing proof data', code: 'BOND_PROOF_INVALID' };
  }
  if ((proof.proofType === 'manual' || proof.proofType === 'declared') && (!proof.amount || proof.amount <= 0n)) {
    return { ok: false, reason: 'Bond proof amount is missing or zero', code: 'BOND_AMOUNT_INSUFFICIENT' };
  }

  if (!verifier) {
    return {
      ok: false,
      reason: `Bond proof type '${proof.proofType}' requires an independent verifier`,
      code: 'REQUIRES_LIVE_VERIFIER',
      requiresLiveVerifier: true,
    };
  }

  try {
    return await verifier.verify(proof);
  } catch (err) {
    return {
      ok: false,
      reason: `Bond proof verification failed: ${(err as Error).message}`,
      code: 'BOND_PROOF_INVALID',
    };
  }
}

export function assertBondMeetsMinimum(proof: BondProofRef, minAmount: bigint): ProviderBondVerifyResult {
  if (!proof.amount || proof.amount < minAmount) {
    return {
      ok: false,
      reason: `Bond amount ${proof.amount?.toString() ?? '0'} is less than minimum ${minAmount.toString()}`,
      code: 'BOND_AMOUNT_INSUFFICIENT',
    };
  }
  return { ok: true, code: 'OK' };
}

export async function verifyBondStack(params: VerifyBondStackParams): Promise<ProviderBondVerifyResult> {
  const { bondStack, bondProofs, verifier } = params;

  if (!bondStack || bondStack.length === 0) {
    return { ok: false, reason: 'Bond stack is empty', code: 'BOND_AMOUNT_INSUFFICIENT' };
  }

  const proofMap = new Map<string, BondProofRef>();
  if (bondProofs) {
    for (const p of bondProofs) {
      proofMap.set(p.bondId, p);
    }
  }

  for (const declaration of bondStack) {
    const proof = proofMap.get(declaration.bondId);
    // RFC-020 C4: every declaration must be backed by a proof.
    if (!proof) {
      return {
        ok: false,
        reason: `No bond proof attached for declaration '${declaration.bondId}'`,
        code: 'BOND_PROOF_INVALID',
      };
    }
    const result = await verifyBondProof(proof, verifier);
    if (!result.ok) return result;
  }

  return { ok: true, code: 'OK' };
}
