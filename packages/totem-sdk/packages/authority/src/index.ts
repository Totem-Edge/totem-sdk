export type {
  ActionIntent,
  MandateBody,
  MandateConstraint,
  UsageLimit,
  AuthorityUsage,
  AuthorityUsageSnapshot,
  MandateStatusSnapshot,
  MandateVerificationResult,
  AuthorityDecision,
  AuthorityIdentityResolver,
} from './types.js';

export {
  computeActionIntentId,
  computeMandateId,
  computeAuthorityDecisionId,
  computeUsageSnapshotHash,
} from './ids.js';

export {
  createAgentMandate,
  createMandateProofDraft,
  signMandateWithLease,
  signMandateUnsafe,
  verifyMandate,
} from './mandate.js';
export type { CreateAgentMandateParams } from './mandate.js';

export { matchScope, matchConstraints } from './scope.js';

export {
  checkUsageLimit,
  calculateUsageDelta,
  snapshotFromUsage,
} from './usage.js';

export { evaluateAuthority } from './evaluate.js';
export type { EvaluateAuthorityParams, EvaluateAuthorityResult } from './evaluate.js';
