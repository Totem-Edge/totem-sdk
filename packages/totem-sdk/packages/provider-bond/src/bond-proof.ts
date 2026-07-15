import type {
  BondProofRef,
  ProviderBondVerifyResult,
  BondProofVerifier,
  VerifyBondStackParams,
  ProviderBondAssetDeclaration,
} from './types.js';

export function verifyBondProof(proof: BondProofRef, verifier?: BondProofVerifier): ProviderBondVerifyResult {
  switch (proof.proofType) {
    case 'manual':
    case 'declared':
      if (!proof.amount || proof.amount <= 0n) {
        return { ok: false, reason: 'Bond proof amount is missing or zero', code: 'BOND_AMOUNT_INSUFFICIENT' };
      }
      return { ok: true, code: 'OK' };

    case 'visible-balance':
      if (verifier) {
        return { ok: true, code: 'OK', requiresLiveVerifier: false };
      }
      return { ok: false, reason: 'Visible-balance proof requires a verifier', code: 'REQUIRES_LIVE_VERIFIER', requiresLiveVerifier: true };

    case 'totem-proof':
      if (proof.proof) {
        return { ok: true, code: 'OK' };
      }
      return { ok: false, reason: 'Totem proof is missing proof data', code: 'BOND_PROOF_INVALID' };

    case 'future-live-chain':
      if (verifier) {
        return { ok: true, code: 'OK', requiresLiveVerifier: false };
      }
      return { ok: false, reason: 'Live chain proof requires a verifier', code: 'REQUIRES_LIVE_VERIFIER', requiresLiveVerifier: true };

    default:
      return { ok: false, reason: `Unsupported proof type: ${(proof as BondProofRef).proofType}`, code: 'UNSUPPORTED_PROOF_TYPE' };
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

export function verifyBondStack(params: VerifyBondStackParams): ProviderBondVerifyResult {
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
    if (proof) {
      const result = verifyBondProof(proof, verifier);
      if (!result.ok) return result;
    }
  }

  return { ok: true, code: 'OK' };
}
