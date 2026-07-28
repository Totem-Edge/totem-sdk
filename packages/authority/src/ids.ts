import { sha3_256, canonicalJson, toHex } from '@totemsdk/proof';
import type { ActionIntent, MandateBody, AuthorityDecision, AuthorityUsageSnapshot } from './types.js';

const DOMAIN_INTENT = 'TOTEM_AUTHORITY_INTENT_V1';
const DOMAIN_MANDATE = 'TOTEM_AUTHORITY_MANDATE_V1';
const DOMAIN_DECISION = 'TOTEM_AUTHORITY_DECISION_V1';
const DOMAIN_USAGE = 'TOTEM_AUTHORITY_USAGE_V1';

function domainHash(domain: string, value: unknown): string {
  const input = domain + canonicalJson(value);
  return toHex(sha3_256(new TextEncoder().encode(input)));
}

export function computeActionIntentId(intent: ActionIntent): string {
  const { nonce: _n, ...rest } = intent;
  const hash = domainHash(DOMAIN_INTENT, rest);
  return 'totem:intent:' + hash;
}

export function computeMandateId(mandate: MandateBody): string {
  const hash = domainHash(DOMAIN_MANDATE, mandate);
  return 'totem:mandate:' + hash;
}

export function computeAuthorityDecisionId(decision: {
  intentId: string;
  mandateId: string;
  mandateVerification: { valid: boolean };
  usageSnapshotHash: string;
  evidenceIds: readonly string[];
  evaluatedAt: number;
  policyVersion: string;
  finalStatus: string;
  matchedRules: readonly string[];
  failedRules: readonly string[];
}): string {
  const canonical = {
    intentId: decision.intentId,
    mandateId: decision.mandateId,
    mandateVerificationValid: decision.mandateVerification.valid,
    usageSnapshotHash: decision.usageSnapshotHash,
    evidenceIds: [...decision.evidenceIds].sort(),
    evaluatedAt: decision.evaluatedAt,
    policyVersion: decision.policyVersion,
    finalStatus: decision.finalStatus,
    matchedRules: [...decision.matchedRules].sort(),
    failedRules: [...decision.failedRules].sort(),
  };
  const hash = domainHash(DOMAIN_DECISION, canonical);
  return 'totem:decision:' + hash;
}

export function computeUsageSnapshotHash(snapshot: AuthorityUsageSnapshot): string {
  return domainHash(DOMAIN_USAGE, snapshot);
}
