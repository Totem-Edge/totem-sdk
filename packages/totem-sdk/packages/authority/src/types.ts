import type { IdentityGraph } from '@totemsdk/identity';

export interface ActionIntent {
  action: string;
  principal: string;
  agent: string;
  target?: string;
  constraints?: Record<string, unknown>;
  nonce?: string;
}

export interface MandateBody {
  grantor: string;
  grantee: string;
  principal: string;
  scope: string;
  constraints?: MandateConstraint[];
  usageLimit?: UsageLimit;
  issuedAt: number;
  expiresAt?: number;
}

export interface MandateConstraint {
  field: string;
  operator: 'eq' | 'lt' | 'lte' | 'gt' | 'gte' | 'in' | 'not_in';
  value: unknown;
}

export interface UsageLimit {
  maxCount?: number;
  maxTotal?: string;
  windowMs?: number;
}

export interface AuthorityUsage {
  usageId: string;
  mandateProofId: string;
  intentId: string;
  usedAt: number;
  countsToward?: { count?: number; amount?: string };
}

export interface AuthorityUsageSnapshot {
  mandateProofId: string;
  totalCount: number;
  totalAmount?: string;
  windowStart?: number;
  windowEnd?: number;
}

export interface MandateStatusSnapshot {
  checkedAt: number;
  revokedMandateIds: readonly string[];
}

export interface MandateVerificationResult {
  valid: boolean;
  reason?: string;
  mandateId?: string;
  grantorAddress?: string;
  granteeAddress?: string;
  principalId?: string;
  identityVerified: boolean;
  scopeMatch: boolean;
  usageExceeded: boolean;
  expired: boolean;
  identityRevoked: boolean;
  mandateRevoked: boolean;
}

export interface AuthorityDecision {
  allowed: boolean;
  reason?: string;
  matchedRules: string[];
  failedRules: string[];
  intentId: string;
  mandateId: string;
  decisionId: string;
  evaluatedAt: number;
  policyVersion: string;
  mandateVerification: MandateVerificationResult;
  usageSnapshot: AuthorityUsageSnapshot;
  usageSnapshotHash: string;
  evidenceIds: readonly string[];
  usageDelta?: { count: number; amount?: string };
}

export interface AuthorityIdentityResolver {
  resolve(identityId: string): IdentityGraph | undefined;
}
