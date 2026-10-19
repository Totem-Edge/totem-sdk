/**
 * `@totemsdk/eefi` — neutral Eefi generic contracts (RFC-050 §5).
 *
 * Data + canonical digests + validation only. Enforcement primitives live in
 * lower layers (`kissvm` covenants, `proof` oracle policy, `edge` negotiation,
 * `omnia` execution). Product-specific terms belong to the product layer.
 */
export type {
  EefiAtomAmount,
  EefiCapitalAgreement,
  EefiContract,
  EefiContractVersion,
  EefiExerciseCovenant,
  EefiExerciseKind,
  EefiFundingTerms,
  EefiHex,
  EefiMarketAgreement,
  EefiMarketSide,
  EefiOperationTerms,
  EefiRiskPolicyRef,
  EefiSettlementTerms,
} from './types.js';

export {
  EEFI_DIGEST_DOMAINS,
  eefiCapitalTermsHash,
  eefiExerciseCovenantHash,
  eefiMarketQuoteDigest,
  eefiRiskPolicyId,
} from './digests.js';

export {
  EefiValidationError,
  validateCapitalAgreement,
  validateEefiContract,
  validateExerciseCovenant,
  validateMarketAgreement,
  validateRiskPolicyRef,
} from './validate.js';
