import { createIdentityDocument, createIdentityClaim, signIdentityClaim } from '@totemsdk/identity';
import { evaluateAuthority } from '../evaluate.js';
import type { AuthorityIdentityResolver, AuthorityUsageSnapshot, ActionIntent } from '../types.js';
import type { IdentityGraph } from '@totemsdk/identity';
import type { SignedProof } from '@totemsdk/proof';
import {
  makeIdentityGraph,
  makeResolver,
  makeMandateProof,
  makeSimpleAction,
  SEED_ROOT,
  SEED_CTRL,
  SEED_DELEGATE,
  SEED_AGENT,
  ADDR_ROOT,
  ADDR_AGENT,
} from './test-helpers.js';
import type { MandateBody } from '../types.js';

describe('evaluateAuthority', () => {
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

  it('allows a valid action within mandate scope', () => {
    const mandate: MandateBody = {
      grantor: ADDR_ROOT,
      grantee: ADDR_AGENT,
      principal: PRINCIPAL_ID,
      scope: 'data:read',
      issuedAt: 1000,
    };
    const signed = makeMandateProof(mandate, SEED_ROOT, 0);
    const action = makeSimpleAction({ action: 'data:read' });

    const { decision, usageDelta } = evaluateAuthority({
      action,
      mandate: signed,
      identityResolver: resolver,
      usageSnapshot,
      now: 2000,
    });

    expect(decision.allowed).toBe(true);
    expect(decision.intentId).toMatch(/^totem:intent:/);
    expect(decision.mandateId).toMatch(/^totem:mandate:/);
    expect(decision.decisionId).toMatch(/^totem:decision:/);
    expect(decision.matchedRules).toContain('scope:match');
    expect(decision.failedRules).toHaveLength(0);
    expect(usageDelta.count).toBe(1);
  });

  it('denies when action is outside mandate scope', () => {
    const mandate: MandateBody = {
      grantor: ADDR_ROOT,
      grantee: ADDR_AGENT,
      principal: PRINCIPAL_ID,
      scope: 'data:read',
      issuedAt: 1000,
    };
    const signed = makeMandateProof(mandate, SEED_ROOT, 0);
    const action = makeSimpleAction({ action: 'data:write' });

    const { decision } = evaluateAuthority({
      action,
      mandate: signed,
      identityResolver: resolver,
      usageSnapshot,
      now: 2000,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.failedRules).toContain('scope:mismatch');
  });

  it('denies when usage limit exceeded', () => {
    const mandate: MandateBody = {
      grantor: ADDR_ROOT,
      grantee: ADDR_AGENT,
      principal: PRINCIPAL_ID,
      scope: 'data:read',
      issuedAt: 1000,
      usageLimit: { maxCount: 3 },
    };
    const signed = makeMandateProof(mandate, SEED_ROOT, 0);
    const action = makeSimpleAction({ action: 'data:read' });
    const highUsage: AuthorityUsageSnapshot = { mandateProofId: 'mp1', totalCount: 5 };

    const { decision } = evaluateAuthority({
      action,
      mandate: signed,
      identityResolver: resolver,
      usageSnapshot: highUsage,
      now: 2000,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.failedRules).toContain('usage:limit_exceeded');
  });

  it('denies when mandate is expired', () => {
    const mandate: MandateBody = {
      grantor: ADDR_ROOT,
      grantee: ADDR_AGENT,
      principal: PRINCIPAL_ID,
      scope: 'data:read',
      issuedAt: 1000,
      expiresAt: 1500,
    };
    const signed = makeMandateProof(mandate, SEED_ROOT, 0);
    const action = makeSimpleAction({ action: 'data:read' });

    const { decision } = evaluateAuthority({
      action,
      mandate: signed,
      identityResolver: resolver,
      usageSnapshot,
      now: 3000,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.mandateVerification.expired).toBe(true);
    expect(decision.failedRules).toContain('mandate:verification:failed');
  });

  it('denies when mandate identity is revoked', async () => {
    const doc = createIdentityDocument({
      kind: 'agent',
      rootAddress: ADDR_ROOT,
      controllerAddress: ADDR_ROOT,
    });
    const revokeClaim = createIdentityClaim({
      type: 'revokes',
      issuer: ADDR_ROOT,
      subject: doc.id,
      object: doc.id,
      issuedAt: 2000,
    });
    const signedRevoke = await signIdentityClaim(revokeClaim, SEED_ROOT, 0);

    const revokedGraph: IdentityGraph = { document: doc, claims: [signedRevoke] };
    const revokedMap = new Map<string, IdentityGraph>();
    revokedMap.set(doc.id, revokedGraph);
    const revokedResolver = makeResolver(revokedMap);

    const mandate: MandateBody = {
      grantor: ADDR_ROOT,
      grantee: ADDR_AGENT,
      principal: doc.id,
      scope: 'data:read',
      issuedAt: 1000,
    };
    const signed = makeMandateProof(mandate, SEED_ROOT, 0);
    const action = makeSimpleAction({ action: 'data:read', principal: doc.id });

    const { decision } = evaluateAuthority({
      action,
      mandate: signed,
      identityResolver: revokedResolver,
      usageSnapshot,
      now: 3000,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.mandateVerification.identityRevoked).toBe(true);
  }, 30000);

  it('passes with wildcard scope and constraints', () => {
    const mandate: MandateBody = {
      grantor: ADDR_ROOT,
      grantee: ADDR_AGENT,
      principal: PRINCIPAL_ID,
      scope: '*',
      issuedAt: 1000,
    };
    const signed = makeMandateProof(mandate, SEED_ROOT, 0);
    const action = makeSimpleAction({ action: 'anything:here' });

    const { decision } = evaluateAuthority({
      action,
      mandate: signed,
      identityResolver: resolver,
      usageSnapshot,
      now: 2000,
    });

    expect(decision.allowed).toBe(true);
  });

  it('returns usageDelta that can be applied to a store', () => {
    const mandate: MandateBody = {
      grantor: ADDR_ROOT,
      grantee: ADDR_AGENT,
      principal: PRINCIPAL_ID,
      scope: 'payment:send',
      issuedAt: 1000,
    };
    const signed = makeMandateProof(mandate, SEED_ROOT, 0);
    const action: ActionIntent = {
      action: 'payment:send',
      principal: PRINCIPAL_ID,
      agent: ADDR_AGENT,
      constraints: { amount: '100' },
    };

    const { decision, usageDelta } = evaluateAuthority({
      action,
      mandate: signed,
      identityResolver: resolver,
      usageSnapshot,
      now: 2000,
    });

    expect(decision.allowed).toBe(true);
    expect(usageDelta.count).toBe(1);
    expect(usageDelta.amount).toBe('100');
  });

  it('includes evidence IDs in decision', () => {
    const mandate: MandateBody = {
      grantor: ADDR_ROOT,
      grantee: ADDR_AGENT,
      principal: PRINCIPAL_ID,
      scope: 'data:read',
      issuedAt: 1000,
    };
    const signed = makeMandateProof(mandate, SEED_ROOT, 0);
    const action = makeSimpleAction();

    const evidenceProof = makeMandateProof(mandate, SEED_ROOT, 1);

    const { decision } = evaluateAuthority({
      action,
      mandate: signed,
      identityResolver: resolver,
      usageSnapshot,
      evidence: [evidenceProof],
      now: 2000,
    });

    expect(decision.allowed).toBe(true);
    expect(Array.isArray(decision.matchedRules)).toBe(true);
    expect(decision.policyVersion).toBe('0.1.0');
  });

  it('denies valid mandate but with constraints mismatch', () => {
    const mandate: MandateBody = {
      grantor: ADDR_ROOT,
      grantee: ADDR_AGENT,
      principal: PRINCIPAL_ID,
      scope: 'data:read',
      issuedAt: 1000,
      constraints: [{ field: 'region', operator: 'eq', value: 'us-east' }],
    };
    const signed = makeMandateProof(mandate, SEED_ROOT, 0);
    const action = makeSimpleAction({
      action: 'data:read',
      constraints: { region: 'eu-west' },
    });

    const { decision } = evaluateAuthority({
      action,
      mandate: signed,
      identityResolver: resolver,
      usageSnapshot,
      now: 2000,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.failedRules).toContain('scope:constraints:failed');
  });
});
