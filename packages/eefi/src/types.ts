/**
 * Eefi generic contract schemas (RFC-050 §5).
 *
 * These are the *generic* Eefi contracts — capital, market, risk and exercise —
 * that products compose. They are data + canonical digests only: no money
 * movement, no script construction and no policy evaluation. Enforcement lives
 * beneath this package:
 *
 * - covenant builders (P-EXIT, collateral, oracle, membership): `@totemsdk/kissvm`
 * - oracle policy runtime: `@totemsdk/proof`
 * - signed negotiation / quote canonicalisation: `@totemsdk/edge`
 * - channel execution: `@totemsdk/omnia`
 *
 * Product-specific terms (strikes, tranche waterfalls, credit schedules) are a
 * product-layer concern and MUST NOT be added here (RFC-050 §1, §12).
 */

/** `0x`-prefixed, even-length hex. */
export type EefiHex = string;

/** Non-negative integer amount in atoms, as a decimal string (never a float). */
export type EefiAtomAmount = string;

export interface EefiFundingTerms {
  /** MSHS-2 policy root authorising capital entry. */
  mashPolicyRoot: EefiHex;
  /** Hash of the exact Omnia program the capital may fund. */
  allowedProgramHash: EefiHex;
  /** Asset ID (native Minima is `0x00`). */
  assetId: EefiHex;
  /** Maximum deployable amount, in atoms. */
  maxAmountAtoms: EefiAtomAmount;
  /** Optional allow-list of counterparties; absent means permissionless. */
  counterparties?: string[];
}

export interface EefiOperationTerms {
  /** Omnia channel program identifier. */
  channelProgramId: string;
  /** Maturity / expiry block height, as a decimal string. */
  maturityBlock: string;
  /** Hash of the committed state-transition rules. */
  stateRulesHash: EefiHex;
  /** Optional oracle/condition policy the operation is bound to. */
  conditionPolicyId?: string;
}

export interface EefiSettlementTerms {
  /** Hash of the exact payout policy (beneficiaries + amounts). */
  payoutPolicyHash: EefiHex;
  /** Hash of the fallback / owner-recovery policy. */
  recoveryPolicyHash: EefiHex;
  /** Optional collateral commitment (bond / liquidation). */
  collateralCommitment?: EefiHex;
}

/**
 * Binds MASH authorisation to Omnia terms and settlement rights.
 *
 * `termsHash` is the canonical digest of `{ funding, operation, settlement }`
 * (see `eefiCapitalTermsHash`) and MUST be recomputed/verified wherever the
 * agreement is enforced — never trusted from storage alone.
 */
export interface EefiCapitalAgreement {
  version: 'eefi-capital/v1';
  termsHash: EefiHex;
  funding: EefiFundingTerms;
  operation: EefiOperationTerms;
  settlement: EefiSettlementTerms;
}

export type EefiMarketSide = 'buy' | 'sell';

/**
 * A signed, finite, executable quote (RFC-050 §5).
 *
 * `quoteId` is the canonical digest of the quote body excluding `quoteId` and
 * `signatureRef` (see `eefiMarketQuoteDigest`). `signatureRef` points at the
 * signed-negotiation digest (e.g. `@totemsdk/edge` TradeAgreement); it is bound
 * separately so the quote can be re-signed without changing its identity.
 */
export interface EefiMarketAgreement {
  version: 'eefi-market/v1';
  quoteId: EefiHex;
  nonce: string;
  side: EefiMarketSide;
  baseAssetId: EefiHex;
  quoteAssetId: EefiHex;
  baseScale: number;
  quoteScale: number;
  exactIn?: EefiAtomAmount;
  exactOut?: EefiAtomAmount;
  /** Price of one base unit in quote atoms, as a decimal string. */
  priceAtoms: EefiAtomAmount;
  /** Fee in basis points (0–10000). */
  feesBps: number;
  maxSlippageBps?: number;
  /** Venue reference (reserve / channel / HTLC plan). */
  venue: string;
  /** Deadline block height, as a decimal string. */
  deadlineBlock: string;
  conditionPolicyId?: string;
  makerId: string;
  takerId: string;
  /** Chain/network domain. */
  domain: string;
  /** Reference to the signed-negotiation digest. */
  signatureRef: EefiHex;
}

/**
 * A declarative risk policy referenced by products. `policyId` is the canonical
 * digest of the policy body excluding `policyId` (see `eefiRiskPolicyId`).
 * This is never a discretionary engine.
 */
export interface EefiRiskPolicyRef {
  version: 'eefi-risk/v1';
  policyId: EefiHex;
  maxExposureAtoms: EefiAtomAmount;
  collateralRatioBps?: number;
  haircutBps?: number;
  liquidationConditionId?: string;
  oraclePolicyIds?: string[];
}

export type EefiExerciseKind =
  | 'unilateral-exercise'
  | 'liquidation'
  | 'maturity-redemption';

/**
 * Descriptor for the P-EXIT primitive (RFC-050 §3). The script itself is built
 * by `@totemsdk/kissvm` (`buildExerciseCovenant` / collateral / oracle
 * templates); this type only commits the condition and the exact payout paths.
 */
export interface EefiExerciseCovenant {
  version: 'eefi-exercise/v1';
  kind: EefiExerciseKind;
  /** Objective on-chain condition (maturity, timeout, oracle witness, default). */
  conditionId: string;
  /** Hash of the exact beneficiary payout path(s). */
  beneficiaryPolicyHash: EefiHex;
  /** Hash of the fallback / owner-reclaim policy. */
  recoveryPolicyHash: EefiHex;
  timelockBlocks: number;
}

export type EefiContract =
  | EefiCapitalAgreement
  | EefiMarketAgreement
  | EefiRiskPolicyRef
  | EefiExerciseCovenant;

export type EefiContractVersion = EefiContract['version'];
