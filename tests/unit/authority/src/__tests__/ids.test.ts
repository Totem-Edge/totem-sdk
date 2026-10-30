import { computeActionIntentId, computeMandateId, computeAuthorityDecisionId, computeUsageSnapshotHash } from '../ids.js';
import type { ActionIntent, MandateBody, AuthorityUsageSnapshot } from '../types.js';

describe('computeActionIntentId', () => {
  it('is deterministic for same input', () => {
    const a1: ActionIntent = { action: 'data:read', principal: 'principal-1', agent: 'MxAGENT' };
    const a2: ActionIntent = { action: 'data:read', principal: 'principal-1', agent: 'MxAGENT' };
    expect(computeActionIntentId(a1)).toBe(computeActionIntentId(a2));
  });

  it('changes when action changes', () => {
    const a1 = { action: 'data:read', principal: 'p', agent: 'MxA' };
    const a2 = { action: 'data:write', principal: 'p', agent: 'MxA' };
    expect(computeActionIntentId(a1)).not.toBe(computeActionIntentId(a2));
  });

  it('changes when principal changes', () => {
    const a1 = { action: 'data:read', principal: 'p1', agent: 'MxA' };
    const a2 = { action: 'data:read', principal: 'p2', agent: 'MxA' };
    expect(computeActionIntentId(a1)).not.toBe(computeActionIntentId(a2));
  });

  it('strips nonce from hash input', () => {
    const a1 = { action: 'data:read', principal: 'p', agent: 'MxA', nonce: 'abc' };
    const a2 = { action: 'data:read', principal: 'p', agent: 'MxA', nonce: 'xyz' };
    expect(computeActionIntentId(a1)).toBe(computeActionIntentId(a2));
  });

  it('includes target if present', () => {
    const a1 = { action: 'data:read', principal: 'p', agent: 'MxA', target: 'resource-1' };
    const a2 = { action: 'data:read', principal: 'p', agent: 'MxA', target: 'resource-2' };
    expect(computeActionIntentId(a1)).not.toBe(computeActionIntentId(a2));
  });

  it('returns a totem:intent: prefixed string', () => {
    const a = { action: 'data:read', principal: 'p', agent: 'MxA' };
    expect(computeActionIntentId(a)).toMatch(/^totem:intent:/);
  });
});

describe('computeMandateId', () => {
  it('is deterministic for same input', () => {
    const m1: MandateBody = { grantor: 'MxA', grantee: 'MxB', principal: 'p', scope: '*', issuedAt: 1000 };
    const m2: MandateBody = { grantor: 'MxA', grantee: 'MxB', principal: 'p', scope: '*', issuedAt: 1000 };
    expect(computeMandateId(m1)).toBe(computeMandateId(m2));
  });

  it('changes when scope changes', () => {
    const m1 = { grantor: 'MxA', grantee: 'MxB', principal: 'p', scope: 'data:read', issuedAt: 1000 };
    const m2 = { grantor: 'MxA', grantee: 'MxB', principal: 'p', scope: 'data:write', issuedAt: 1000 };
    expect(computeMandateId(m1)).not.toBe(computeMandateId(m2));
  });

  it('returns a totem:mandate: prefixed string', () => {
    const m = { grantor: 'MxA', grantee: 'MxB', principal: 'p', scope: '*', issuedAt: 1000 };
    expect(computeMandateId(m)).toMatch(/^totem:mandate:/);
  });
});

describe('computeAuthorityDecisionId', () => {
  const base = {
    intentId: 'totem:intent:abc',
    mandateId: 'totem:mandate:def',
    mandateVerification: { valid: true },
    usageSnapshotHash: 'hash1',
    evidenceIds: ['ev1', 'ev2'],
    evaluatedAt: 2000,
    policyVersion: '0.1.0',
    finalStatus: 'allowed',
    matchedRules: ['rule1'],
    failedRules: [] as string[],
  };

  it('is deterministic', () => {
    expect(computeAuthorityDecisionId(base)).toBe(computeAuthorityDecisionId({ ...base }));
  });

  it('changes when finalStatus changes', () => {
    const denied = { ...base, finalStatus: 'denied' };
    expect(computeAuthorityDecisionId(base)).not.toBe(computeAuthorityDecisionId(denied));
  });

  it('sorts evidenceIds and rule arrays', () => {
    const shuffled = { ...base, evidenceIds: ['ev2', 'ev1'] };
    expect(computeAuthorityDecisionId(base)).toBe(computeAuthorityDecisionId(shuffled));
  });

  it('returns a totem:decision: prefixed string', () => {
    const id = computeAuthorityDecisionId(base);
    expect(id).toMatch(/^totem:decision:/);
  });
});

describe('computeUsageSnapshotHash', () => {
  it('is deterministic', () => {
    const s1: AuthorityUsageSnapshot = { mandateProofId: 'mp1', totalCount: 5 };
    const s2: AuthorityUsageSnapshot = { mandateProofId: 'mp1', totalCount: 5 };
    expect(computeUsageSnapshotHash(s1)).toBe(computeUsageSnapshotHash(s2));
  });

  it('changes when count changes', () => {
    const s1 = { mandateProofId: 'mp1', totalCount: 5 };
    const s2 = { mandateProofId: 'mp1', totalCount: 6 };
    expect(computeUsageSnapshotHash(s1)).not.toBe(computeUsageSnapshotHash(s2));
  });
});
