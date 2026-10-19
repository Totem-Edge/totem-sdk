/**
 * Canonical, domain-separated digests for the Eefi contracts.
 *
 * All digests reuse `@totemsdk/core`'s canonical JSON (`canonicalJson`) and
 * SHA3-256 (`hashCanonical`) so there is exactly one canonical form in the SDK.
 * Digests are returned `0x`-prefixed to match `EefiHex`.
 */
import { hashCanonical } from '@totemsdk/core';
import type {
  EefiCapitalAgreement,
  EefiExerciseCovenant,
  EefiMarketAgreement,
  EefiRiskPolicyRef,
} from './types.js';

export const EEFI_DIGEST_DOMAINS = {
  capitalTerms: 'eefi:capital-terms:v1',
  marketQuote: 'eefi:market-quote:v1',
  riskPolicy: 'eefi:risk-policy:v1',
  exerciseCovenant: 'eefi:exercise-covenant:v1',
} as const;

function stripUndefined(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripUndefined);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (entry !== undefined) out[key] = stripUndefined(entry);
    }
    return out;
  }
  return value;
}

function digest(domain: string, value: unknown): string {
  return '0x' + hashCanonical(domain, stripUndefined(value));
}

/** Canonical digest of the enforcement-relevant capital terms. */
export function eefiCapitalTermsHash(
  agreement: Pick<EefiCapitalAgreement, 'funding' | 'operation' | 'settlement'>,
): string {
  return digest(EEFI_DIGEST_DOMAINS.capitalTerms, {
    funding: agreement.funding,
    operation: agreement.operation,
    settlement: agreement.settlement,
  });
}

/** Canonical quote identity, excluding `quoteId` and the signature reference. */
export function eefiMarketQuoteDigest(
  agreement: EefiMarketAgreement,
): string {
  const body: Record<string, unknown> = { ...agreement };
  delete body.quoteId;
  delete body.signatureRef;
  return digest(EEFI_DIGEST_DOMAINS.marketQuote, body);
}

/** Canonical risk-policy identity, excluding `policyId`. */
export function eefiRiskPolicyId(policy: EefiRiskPolicyRef): string {
  const body: Record<string, unknown> = { ...policy };
  delete body.policyId;
  return digest(EEFI_DIGEST_DOMAINS.riskPolicy, body);
}

/** Canonical digest of an exercise/liquidation covenant descriptor. */
export function eefiExerciseCovenantHash(
  covenant: EefiExerciseCovenant,
): string {
  return digest(EEFI_DIGEST_DOMAINS.exerciseCovenant, covenant);
}
