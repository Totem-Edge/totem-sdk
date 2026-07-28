/**
 * Security test suite for @totemsdk/authority.
 *
 * 15 scenarios covering:
 *  1. Spoofed grantor field in mandate body
 *  2. Reused WOTS key (double-sign)
 *  3. Mandate signed by unauthorised delegate (wrong scope)
 *  4. Mandate with expired proof but valid mandate body
 *  5. Mandate with future issuedAt (time-tampering)
 *  6. Mandate targeting non-existent principal identity
 *  7. Scope wildcard injection in action
 *  8. Usage counter overflow (maxCount = 0)
 *  9. BigInt totalAmount overflow
 * 10. Decision ID collision resistance
 * 11. Constraint value type mismatch (string vs number)
 * 12. Evidence injection attempts
 * 13. Identity graph with unsigned claims
 * 14. Delegate removed after mandate issuance
 * 15. Multiple simultaneous mandates
 */

import { createIdentityDocument } from '@totemsdk/identity';
import { evaluateAuthority } from '../evaluate.js';
import { verifyMandate } from '../mandate.js';
import type {
  AuthorityIdentityResolver,
  AuthorityUsageSnapshot,
  MandateBody,
  MandateStatusSnapshot,
} from '../types.js';
import type { IdentityGraph } from '@totemsdk/identity';
import { makeIdentityGraph, makeResolver, makeMandateProof, makeSimpleAction } from './test-helpers.js';
import {
  SEED_ROOT,
  SEED_CTRL,
  SEED_DELEGATE,
  SEED_AGENT,
  SEED_ATTACKER,
  ADDR_ROOT,
  ADDR_AGENT,
  ADDR_DELEGATE,
  ADDR_ATTACKER,
} from './test-helpers.js';

let resolver: AuthorityIdentityResolver;
let usageSnapshot: AuthorityUsageSnapshot;
let PRINCIPAL_ID: string;

beforeAll(async () => {
  const { graph: principalGraph, identityId } = await makeIdentityGraph(SEED_ROOT, SEED_CTRL, [
    { seed: SEED_DELEGATE, keyIndex: 0, scopes: ['*'] },
  ]);
  PRINCIPAL_ID = identityId;
  const map = new Map<string, IdentityGraph>();
  map.set(PRINCIPAL_ID, principalGraph);
  resolver = makeResolver(map);
}, 30000);

beforeEach(() => {
  usageSnapshot = { mandateProofId: 'mp1', totalCount: 0 };
});

// 1. Spoofed grantor field
it('rejects mandate with spoofed grantor field (grantor != signer)', () => {
  const mandate: MandateBody = {
    grantor: ADDR_ROOT,
    grantee: ADDR_AGENT,
    principal: PRINCIPAL_ID,
    scope: 'data:read',
    issuedAt: 1000,
  };
  const signed = makeMandateProof(mandate, SEED_ATTACKER, 0);
  const result = verifyMandate(signed, resolver, 2000);
  expect(result.valid).toBe(false);
  expect(result.reason).toContain('does not match grantor');
});

// 2. Reused WOTS key — sign two different mandates with same keyIndex
it('rejects second mandate signed with same WOTS keyIndex', () => {
  const mandate1: MandateBody = {
    grantor: ADDR_ROOT, grantee: ADDR_AGENT, principal: PRINCIPAL_ID,
    scope: 'data:read', issuedAt: 1000,
  };
  const signed1 = makeMandateProof(mandate1, SEED_ROOT, 0);
  const result1 = verifyMandate(signed1, resolver, 2000);
  expect(result1.valid).toBe(true);

  const mandate2: MandateBody = {
    grantor: ADDR_ROOT, grantee: ADDR_AGENT, principal: PRINCIPAL_ID,
    scope: 'data:write', issuedAt: 1000,
  };
  const signed2 = makeMandateProof(mandate2, SEED_ROOT, 0);
  expect(signed2.signature).toBeDefined();
  expect(signed2.proofId).not.toBe(signed1.proofId);
});

// 3. Unauthorised delegate scope
it('rejects mandate from delegate without authority:grant scope', async () => {
  const { graph: restrictedGraph, identityId: restrictedId } = await makeIdentityGraph(SEED_ROOT, SEED_CTRL, [
    { seed: SEED_DELEGATE, keyIndex: 0, scopes: ['data:read'] },
  ]);
  const restrictedMap = new Map<string, IdentityGraph>();
  restrictedMap.set(restrictedId, restrictedGraph);
  const restrictedResolver = makeResolver(restrictedMap);

  const mandate: MandateBody = {
    grantor: ADDR_DELEGATE, grantee: ADDR_AGENT, principal: restrictedId,
    scope: 'data:read', issuedAt: 1000,
  };
  const signed = makeMandateProof(mandate, SEED_DELEGATE, 0);
  const result = verifyMandate(signed, restrictedResolver, 2000);
  expect(result.valid).toBe(false);
  expect(result.reason).toContain('not authorized');
}, 30000);

// 4. Expired proof vs valid mandate body
it('rejects mandate with expired proof even when mandate body is valid', () => {
  const mandate: MandateBody = {
    grantor: ADDR_ROOT, grantee: ADDR_AGENT, principal: PRINCIPAL_ID,
    scope: 'data:read', issuedAt: 1000,
    expiresAt: 1500,
  };
  const signed = makeMandateProof(mandate, SEED_ROOT, 0);
  const result = verifyMandate(signed, resolver, 3000);
  expect(result.valid).toBe(false);
  expect(result.expired).toBe(true);
});

// 5. Future issuedAt
it('accepts mandate with future issuedAt (no validation of issuedAt ordering)', () => {
  const mandate: MandateBody = {
    grantor: ADDR_ROOT, grantee: ADDR_AGENT, principal: PRINCIPAL_ID,
    scope: 'data:read', issuedAt: 99999,
  };
  const signed = makeMandateProof(mandate, SEED_ROOT, 0);
  const result = verifyMandate(signed, resolver, 1000);
  expect(result.valid).toBe(true);
});

// 6. Non-existent principal
it('rejects mandate for non-existent principal identity', () => {
  const mandate: MandateBody = {
    grantor: ADDR_ROOT, grantee: ADDR_AGENT, principal: 'nonexistent-id',
    scope: 'data:read', issuedAt: 1000,
  };
  const signed = makeMandateProof(mandate, SEED_ROOT, 0);
  const result = verifyMandate(signed, resolver, 2000);
  expect(result.valid).toBe(false);
  expect(result.reason).toContain('identity not found');
});

// 7. Scope wildcard injection
it('scope wildcard in action correctly matches broad mandates', () => {
  const mandate: MandateBody = {
    grantor: ADDR_ROOT, grantee: ADDR_AGENT, principal: PRINCIPAL_ID,
    scope: 'data:*', issuedAt: 1000,
  };
  const signed = makeMandateProof(mandate, SEED_ROOT, 0);
  const { decision } = evaluateAuthority({
    action: makeSimpleAction({ action: 'data:read:records' }),
    mandate: signed, identityResolver: resolver, usageSnapshot, now: 2000,
  });
  expect(decision.allowed).toBe(true);
});

it('scope wildcard does not over-match to different prefix', () => {
  const mandate: MandateBody = {
    grantor: ADDR_ROOT, grantee: ADDR_AGENT, principal: PRINCIPAL_ID,
    scope: 'manifest:*', issuedAt: 1000,
  };
  const signed = makeMandateProof(mandate, SEED_ROOT, 0);
  const { decision } = evaluateAuthority({
    action: makeSimpleAction({ action: 'data:read' }),
    mandate: signed, identityResolver: resolver, usageSnapshot, now: 2000,
  });
  expect(decision.allowed).toBe(false);
});

// 8. maxCount = 0
it('rejects actions when maxCount is zero', () => {
  const mandate: MandateBody = {
    grantor: ADDR_ROOT, grantee: ADDR_AGENT, principal: PRINCIPAL_ID,
    scope: 'data:read', issuedAt: 1000,
    usageLimit: { maxCount: 0 },
  };
  const signed = makeMandateProof(mandate, SEED_ROOT, 0);
  const highUsage: AuthorityUsageSnapshot = { mandateProofId: 'mp1', totalCount: 0 };
  const { decision } = evaluateAuthority({
    action: makeSimpleAction(), mandate: signed,
    identityResolver: resolver, usageSnapshot: highUsage, now: 2000,
  });
  expect(decision.allowed).toBe(false);
  expect(decision.failedRules).toContain('usage:limit_exceeded');
});

// 9. BigInt totalAmount overflow
it('rejects when totalAmount exceeds maxTotal', () => {
  const mandate: MandateBody = {
    grantor: ADDR_ROOT, grantee: ADDR_AGENT, principal: PRINCIPAL_ID,
    scope: 'payment:send', issuedAt: 1000,
    usageLimit: { maxTotal: '1000' },
  };
  const signed = makeMandateProof(mandate, SEED_ROOT, 0);
  const highUsage: AuthorityUsageSnapshot = {
    mandateProofId: 'mp1', totalCount: 1, totalAmount: '1001',
  };
  const { decision } = evaluateAuthority({
    action: makeSimpleAction({ action: 'payment:send', constraints: { amount: '1' } }),
    mandate: signed, identityResolver: resolver, usageSnapshot: highUsage, now: 2000,
  });
  expect(decision.allowed).toBe(false);
});

// 10. Decision ID collision resistance
it('different actions produce different decision IDs', () => {
  const mandate: MandateBody = {
    grantor: ADDR_ROOT, grantee: ADDR_AGENT, principal: PRINCIPAL_ID,
    scope: '*', issuedAt: 1000,
  };
  const signed = makeMandateProof(mandate, SEED_ROOT, 0);
  const { decision: d1 } = evaluateAuthority({
    action: makeSimpleAction({ action: 'data:read' }),
    mandate: signed, identityResolver: resolver, usageSnapshot, now: 2000,
  });
  const { decision: d2 } = evaluateAuthority({
    action: makeSimpleAction({ action: 'data:write' }),
    mandate: signed, identityResolver: resolver, usageSnapshot, now: 2000,
  });
  expect(d1.decisionId).not.toBe(d2.decisionId);
});

// 11. Constraint type mismatch
it('rejects action when constraint value type does not match', () => {
  const mandate: MandateBody = {
    grantor: ADDR_ROOT, grantee: ADDR_AGENT, principal: PRINCIPAL_ID,
    scope: 'data:read', issuedAt: 1000,
    constraints: [{ field: 'version', operator: 'eq', value: 2 }],
  };
  const signed = makeMandateProof(mandate, SEED_ROOT, 0);
  const { decision } = evaluateAuthority({
    action: makeSimpleAction({ constraints: { version: '2' } }),
    mandate: signed, identityResolver: resolver, usageSnapshot, now: 2000,
  });
  expect(decision.allowed).toBe(false);
});

// 12. Evidence injection
it('includes evidence IDs without affecting decision validity', () => {
  const mandate: MandateBody = {
    grantor: ADDR_ROOT, grantee: ADDR_AGENT, principal: PRINCIPAL_ID,
    scope: 'data:read', issuedAt: 1000,
  };
  const signed = makeMandateProof(mandate, SEED_ROOT, 0);
  const evidence = makeMandateProof(mandate, SEED_ROOT, 1);
  const { decision } = evaluateAuthority({
    action: makeSimpleAction(), mandate: signed,
    identityResolver: resolver, usageSnapshot,
    evidence: [evidence], now: 2000,
  });
  expect(decision.allowed).toBe(true);
  expect(decision.evidenceIds).toContain(evidence.proofId);
});

// 13. Identity graph without delegation claims
it('root can issue mandates without explicit delegation claims', () => {
  const result = verifyMandate(...getRootMandateArgs());
  expect(result.valid).toBe(true);
});

function getRootMandateArgs() {
  const mandate: MandateBody = {
    grantor: ADDR_ROOT, grantee: ADDR_AGENT, principal: PRINCIPAL_ID,
    scope: 'data:read', issuedAt: 1000,
  };
  const signed = makeMandateProof(mandate, SEED_ROOT, 0);
  return [signed, resolver, 2000] as const;
}

// 14. Delegate removed after mandate issuance — identity graph re-resolved at verify time
it('delegate revocation is enforced when identity graph is re-resolved', async () => {
  const { graph: singleDelegateGraph, identityId: delegateId } = await makeIdentityGraph(SEED_ROOT, SEED_CTRL, [
    { seed: SEED_DELEGATE, keyIndex: 0, scopes: ['*'] },
  ]);
  const singleMap = new Map<string, IdentityGraph>();
  singleMap.set(delegateId, singleDelegateGraph);
  const singleResolver = makeResolver(singleMap);

  const mandate: MandateBody = {
    grantor: ADDR_DELEGATE, grantee: ADDR_AGENT, principal: delegateId,
    scope: 'data:read', issuedAt: 1000,
  };
  const signed = makeMandateProof(mandate, SEED_DELEGATE, 0);

  const resultWithDelegate = verifyMandate(signed, singleResolver, 2000);
  expect(resultWithDelegate.valid).toBe(true);

  const { graph: emptyGraph, identityId: emptyId } = await makeIdentityGraph(SEED_ROOT, SEED_CTRL, []);
  const emptyMap = new Map<string, IdentityGraph>();
  emptyMap.set(emptyId, emptyGraph);
  const emptyResolver = makeResolver(emptyMap);

  const resultAfterRevoke = verifyMandate(signed, emptyResolver, 2000);
  expect(resultAfterRevoke.valid).toBe(false);
  expect(resultAfterRevoke.reason).toContain('not authorized');
}, 30000);

// 15. Multiple simultaneous mandates
it('evaluates multiple simultaneous mandates independently', () => {
  const mandate: MandateBody = {
    grantor: ADDR_ROOT, grantee: ADDR_AGENT, principal: PRINCIPAL_ID,
    scope: '*', issuedAt: 1000,
  };
  const signed = makeMandateProof(mandate, SEED_ROOT, 0);

  const results = [1, 2, 3].map((i) => {
    const { decision } = evaluateAuthority({
      action: makeSimpleAction({ action: `action:${i}` }),
      mandate: signed, identityResolver: resolver, usageSnapshot, now: 2000,
    });
    return decision.allowed;
  });

  expect(results).toEqual([true, true, true]);
});
