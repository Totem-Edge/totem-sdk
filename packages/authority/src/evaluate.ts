import type { SignedProof } from '@totemsdk/proof';
import type {
  ActionIntent,
  AuthorityDecision,
  AuthorityIdentityResolver,
  AuthorityUsageSnapshot,
  MandateStatusSnapshot,
  MandateBody,
} from './types.js';
import { verifyMandate } from './mandate.js';
import { matchScope, matchConstraints } from './scope.js';
import { checkUsageLimit, calculateUsageDelta } from './usage.js';
import { computeActionIntentId, computeAuthorityDecisionId, computeUsageSnapshotHash } from './ids.js';

export interface EvaluateAuthorityParams {
  action: ActionIntent;
  mandate: SignedProof;
  identityResolver: AuthorityIdentityResolver;
  usageSnapshot: AuthorityUsageSnapshot;
  mandateStatus?: MandateStatusSnapshot;
  evidence?: SignedProof[];
  now: number;
  graceMs?: number;
  policyVersion?: string;
}

export interface EvaluateAuthorityResult {
  decision: AuthorityDecision;
  usageDelta: { count: number; amount?: string };
}

export function evaluateAuthority(params: EvaluateAuthorityParams): EvaluateAuthorityResult {
  const {
    action,
    mandate,
    identityResolver,
    usageSnapshot,
    mandateStatus,
    evidence,
    now,
    graceMs,
    policyVersion,
  } = params;

  const intentId = computeActionIntentId(action);
  const usageDelta = calculateUsageDelta(action);
  const mandateBody = mandate.payload?.mandate as MandateBody | undefined;

  const mandateVerification = verifyMandate(mandate, identityResolver, now, graceMs ?? 0, mandateStatus);

  const matchedRules: string[] = [];
  const failedRules: string[] = [];

  if (mandateVerification.valid) {
    matchedRules.push('mandate:crypto:valid');
    matchedRules.push('mandate:signer:matches_grantor');
    matchedRules.push('mandate:identity:verified');
  } else {
    failedRules.push('mandate:verification:failed');
  }

  let scopeMatch = false;
  let constraintsMatch = true;
  let actorBound = true;
  let principalBound = true;
  if (mandateBody && mandateVerification.valid) {
    // Mandatory actor/principal binding (AUD-017): the action's agent must be
    // the mandate's grantee and the action's principal must be the mandate's
    // principal. Without this, a valid signed mandate authorized any unrelated
    // agent/principal and only constraints (if any) provided binding.
    actorBound = action.agent === mandateBody.grantee;
    principalBound = action.principal === mandateBody.principal;
    if (actorBound) {
      matchedRules.push('binding:grantee:match');
    } else {
      failedRules.push('binding:grantee:mismatch');
    }
    if (principalBound) {
      matchedRules.push('binding:principal:match');
    } else {
      failedRules.push('binding:principal:mismatch');
    }

    scopeMatch = matchScope(action.action, mandateBody.scope);
    if (scopeMatch) {
      matchedRules.push('scope:match');
    } else {
      failedRules.push('scope:mismatch');
    }

    constraintsMatch =
      !mandateBody.constraints || mandateBody.constraints.length === 0
        ? true
        : matchConstraints(action, mandateBody.constraints);
    if (constraintsMatch) {
      matchedRules.push('scope:constraints:passed');
    } else {
      failedRules.push('scope:constraints:failed');
    }
  }

  let usageExceeded = false;
  if (mandateBody?.usageLimit && scopeMatch) {
    usageExceeded = !checkUsageLimit(usageSnapshot, mandateBody.usageLimit, now, usageDelta);
    if (usageExceeded) {
      failedRules.push('usage:limit_exceeded');
    } else {
      matchedRules.push('usage:within_limits');
    }
  }

  const mandateId = mandateVerification.mandateId ?? '';
  const usageSnapshotHash = computeUsageSnapshotHash(usageSnapshot);

  const evidenceIds = (evidence ?? []).map((e) => e.proofId).slice().sort();

  const allowed =
    mandateVerification.valid && actorBound && principalBound && scopeMatch && constraintsMatch && !usageExceeded;

  const decisionBase = {
    intentId,
    mandateId,
    mandateVerification,
    usageSnapshotHash,
    evidenceIds,
    evaluatedAt: now,
    policyVersion: policyVersion ?? '0.1.0',
    finalStatus: allowed ? 'allowed' : 'denied',
    matchedRules,
    failedRules,
  };

  const decisionId = computeAuthorityDecisionId(decisionBase);

  const decision: AuthorityDecision = {
    ...decisionBase,
    decisionId,
    allowed,
    reason: allowed
      ? undefined
      : failedRules.length > 0
        ? `denied by rules: ${failedRules.join(', ')}`
        : 'authority evaluation failed',
    usageSnapshot,
    usageDelta,
  };

  return { decision, usageDelta };
}
