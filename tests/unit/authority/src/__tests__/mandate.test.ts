import { createIdentityDocument, createIdentityClaim, signIdentityClaim } from '@totemsdk/identity';
import {
  createAgentMandate,
  createMandateProofDraft,
  signMandateWithLease,
  verifyMandate,
} from '../mandate.js';
import { computeMandateId } from '../ids.js';
import type { MandateBody, AuthorityIdentityResolver, MandateStatusSnapshot } from '../types.js';
import type { IdentityGraph } from '@totemsdk/identity';
import {
  makeIdentityGraph,
  makeResolver,
  makeMandateProof,
  SEED_ROOT,
  SEED_CTRL,
  SEED_DELEGATE,
  SEED_AGENT,
  SEED_ATTACKER,
  ADDR_ROOT,
  ADDR_CTRL,
  ADDR_DELEGATE,
  ADDR_AGENT,
  ADDR_ATTACKER,
} from './test-helpers.js';

describe('createAgentMandate', () => {
  it('creates a mandate body with required fields', () => {
    const m = createAgentMandate({
      grantor: ADDR_ROOT,
      grantee: ADDR_AGENT,
      principal: 'totem:id:agent:test',
      scope: 'data:read',
    });
    expect(m.grantor).toBe(ADDR_ROOT);
    expect(m.grantee).toBe(ADDR_AGENT);
    expect(m.principal).toBe('totem:id:agent:test');
    expect(m.scope).toBe('data:read');
    expect(typeof m.issuedAt).toBe('number');
  });

  it('includes optional fields when provided', () => {
    const m = createAgentMandate({
      grantor: ADDR_ROOT,
      grantee: ADDR_AGENT,
      principal: 'totem:id:agent:test',
      scope: '*',
      constraints: [{ field: 'region', operator: 'eq', value: 'us-east' }],
      usageLimit: { maxCount: 5 },
      expiresAt: 5000,
    });
    expect(m.constraints).toHaveLength(1);
    expect(m.usageLimit).toEqual({ maxCount: 5 });
    expect(m.expiresAt).toBe(5000);
  });
});

describe('createMandateProofDraft', () => {
  it('creates an unsigned proof with correct schema', () => {
    const mandate: MandateBody = {
      grantor: ADDR_ROOT,
      grantee: ADDR_AGENT,
      principal: 'totem:id:agent:test',
      scope: 'data:read',
      issuedAt: 1000,
    };
    const draft = createMandateProofDraft(mandate);
    expect(draft.payload?.schema).toBe('totem:authority:mandate/v1');
    expect(draft.payload?.mandate).toEqual(mandate);
    expect(draft.kind).toBe('custom');
    expect(draft.signature).toBeUndefined();
  });
});

describe('signMandateWithLease', () => {
  it('signs via lease provider', async () => {
    const mandate: MandateBody = {
      grantor: ADDR_ROOT,
      grantee: ADDR_AGENT,
      principal: 'totem:id:agent:test',
      scope: 'data:read',
      issuedAt: 1000,
    };
    const draft = createMandateProofDraft(mandate);

    const leaseProvider = {
      async reserveKeyUse() {
        return { reservationId: 'res-1', indices: { start: 0, count: 1, treeId: 'default' } };
      },
      async commitKeyUse() {},
      async burnReservation() {},
    };

    const signed = await signMandateWithLease(draft, SEED_ROOT, leaseProvider);
    expect(signed.signature).toBeDefined();
    expect(signed.proofId).toBeDefined();
  });
});

describe('mandate signing via makeMandateProof', () => {
  it('signs the mandate proof draft', () => {
    const mandate: MandateBody = {
      grantor: ADDR_ROOT,
      grantee: ADDR_AGENT,
      principal: 'totem:id:agent:test',
      scope: 'data:read',
      issuedAt: 1000,
    };
    const signed = makeMandateProof(mandate, SEED_ROOT, 0);
    expect(signed.signature).toBeDefined();
    expect(signed.proofId).toBeDefined();
  });
});

describe('verifyMandate', () => {
  let principalGraph: IdentityGraph;
  let resolver: AuthorityIdentityResolver;
  let PRINCIPAL_ID: string;

  beforeAll(async () => {
    const result = await makeIdentityGraph(SEED_ROOT, SEED_CTRL, [
      { seed: SEED_DELEGATE, keyIndex: 0, scopes: ['*'] },
    ]);
    principalGraph = result.graph;
    PRINCIPAL_ID = result.identityId;
    const map = new Map<string, IdentityGraph>();
    map.set(PRINCIPAL_ID, principalGraph);
    resolver = makeResolver(map);
  }, 30000);

  it('accepts a valid mandate from root', () => {
    const mandate: MandateBody = {
      grantor: ADDR_ROOT,
      grantee: ADDR_AGENT,
      principal: PRINCIPAL_ID,
      scope: 'data:read',
      issuedAt: 1000,
    };
    const signed = makeMandateProof(mandate, SEED_ROOT, 0);
    const result = verifyMandate(signed, resolver, 2000);
    expect(result.valid).toBe(true);
    expect(result.identityVerified).toBe(true);
    expect(result.scopeMatch).toBe(true);
    expect(result.usageExceeded).toBe(false);
    expect(result.expired).toBe(false);
    expect(result.mandateId).toMatch(/^totem:mandate:/);
  });

  it('accepts a valid mandate from a delegate with authority:grant scope', async () => {
    const { graph: delegateGraph, identityId: delegateId } = await makeIdentityGraph(SEED_ROOT, SEED_CTRL, [
      { seed: SEED_DELEGATE, keyIndex: 0, scopes: ['authority:grant', 'data:read'] },
    ]);
    const delegateResolverMap = new Map<string, IdentityGraph>();
    delegateResolverMap.set(delegateId, delegateGraph);
    const delegateResolver = makeResolver(delegateResolverMap);

    const mandate: MandateBody = {
      grantor: ADDR_DELEGATE,
      grantee: ADDR_AGENT,
      principal: delegateId,
      scope: 'data:read',
      issuedAt: 1000,
    };
    const signed = makeMandateProof(mandate, SEED_DELEGATE, 0);
    const result = verifyMandate(signed, delegateResolver, 2000);
    expect(result.valid).toBe(true);
    expect(result.grantorAddress).toBe(ADDR_DELEGATE);
  }, 30000);

  it('rejects mandate with invalid payload schema', () => {
    const mandate: MandateBody = {
      grantor: ADDR_ROOT,
      grantee: ADDR_AGENT,
      principal: PRINCIPAL_ID,
      scope: 'data:read',
      issuedAt: 1000,
    };
    const signed = makeMandateProof(mandate, SEED_ROOT, 0);
    signed.payload.schema = 'invalid:schema';
    const result = verifyMandate(signed, resolver, 2000);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('invalid payload schema');
  });

  it('rejects mandate where proof signer does not match grantor', () => {
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

  it('rejects expired mandate', () => {
    const mandate: MandateBody = {
      grantor: ADDR_ROOT,
      grantee: ADDR_AGENT,
      principal: PRINCIPAL_ID,
      scope: 'data:read',
      issuedAt: 1000,
      expiresAt: 1500,
    };
    const signed = makeMandateProof(mandate, SEED_ROOT, 0);
    const result = verifyMandate(signed, resolver, 3000);
    expect(result.valid).toBe(false);
    expect(result.expired).toBe(true);
  });

  it('accepts expired mandate within grace period', () => {
    const mandate: MandateBody = {
      grantor: ADDR_ROOT,
      grantee: ADDR_AGENT,
      principal: PRINCIPAL_ID,
      scope: 'data:read',
      issuedAt: 1000,
      expiresAt: 1500,
    };
    const signed = makeMandateProof(mandate, SEED_ROOT, 0);
    const result = verifyMandate(signed, resolver, 1600, 200);
    expect(result.valid).toBe(true);
  });

  it('rejects mandate when principal identity is revoked', async () => {
    const rootAddr = ADDR_ROOT;
    const doc = createIdentityDocument({
      kind: 'agent',
      rootAddress: rootAddr,
      controllerAddress: rootAddr,
    });

    const revokeClaim = createIdentityClaim({
      type: 'revokes',
      issuer: rootAddr,
      subject: doc.id,
      object: doc.id,
      issuedAt: 2000,
    });
    const signedRevoke = await signIdentityClaim(revokeClaim, SEED_ROOT, 0);

    const revokedGraph: IdentityGraph = { document: doc, claims: [signedRevoke] };
    const revokedMap = new Map<string, IdentityGraph>();
    const revokedId = doc.id;
    revokedMap.set(revokedId, revokedGraph);
    const revokedResolver = makeResolver(revokedMap);

    const mandate: MandateBody = {
      grantor: rootAddr,
      grantee: ADDR_AGENT,
      principal: revokedId,
      scope: 'data:read',
      issuedAt: 1000,
    };
    const signed = makeMandateProof(mandate, SEED_ROOT, 0);
    const result = verifyMandate(signed, revokedResolver, 3000);
    expect(result.valid).toBe(false);
    expect(result.identityRevoked).toBe(true);
  }, 30000);

  it('rejects mandate when resolved identity ID does not match', () => {
    const wrongGraph: IdentityGraph = {
      document: {
        id: 'wrong-id',
        kind: 'agent',
        version: 1,
        rootAddress: ADDR_ROOT,
        controllerAddress: ADDR_CTRL,
        createdAt: 1000,
      },
      claims: [],
    };
    const wrongMap = new Map<string, IdentityGraph>();
    wrongMap.set(PRINCIPAL_ID, wrongGraph);
    const wrongResolver = makeResolver(wrongMap);

    const mandate: MandateBody = {
      grantor: ADDR_ROOT,
      grantee: ADDR_AGENT,
      principal: PRINCIPAL_ID,
      scope: 'data:read',
      issuedAt: 1000,
    };
    const signed = makeMandateProof(mandate, SEED_ROOT, 0);
    const result = verifyMandate(signed, wrongResolver, 2000);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('does not match requested');
  });

  it('rejects mandate when principal identity not found', () => {
    const emptyResolver: AuthorityIdentityResolver = {
      resolve() { return undefined; },
    };
    const mandate: MandateBody = {
      grantor: ADDR_ROOT,
      grantee: ADDR_AGENT,
      principal: 'nonexistent',
      scope: 'data:read',
      issuedAt: 1000,
    };
    const signed = makeMandateProof(mandate, SEED_ROOT, 0);
    const result = verifyMandate(signed, emptyResolver, 2000);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('identity not found');
  });

  it('rejects mandate when grantor is not authorized', async () => {
    const { graph: unattachedGraph, identityId: unattachedId } = await makeIdentityGraph(SEED_ROOT, SEED_CTRL, []);
    const unattachedMap = new Map<string, IdentityGraph>();
    unattachedMap.set(unattachedId, unattachedGraph);
    const unattachedResolver = makeResolver(unattachedMap);

    const mandate: MandateBody = {
      grantor: ADDR_ATTACKER,
      grantee: ADDR_AGENT,
      principal: unattachedId,
      scope: 'data:read',
      issuedAt: 1000,
    };
    const signed = makeMandateProof(mandate, SEED_ATTACKER, 0);
    const result = verifyMandate(signed, unattachedResolver, 2000);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('not authorized');
  }, 30000);

  it('rejects revoked mandate via status snapshot', () => {
    const mandate: MandateBody = {
      grantor: ADDR_ROOT,
      grantee: ADDR_AGENT,
      principal: PRINCIPAL_ID,
      scope: 'data:read',
      issuedAt: 1000,
    };
    const signed = makeMandateProof(mandate, SEED_ROOT, 0);
    const mandateId = computeMandateId(mandate);
    const statusSnapshot: MandateStatusSnapshot = {
      checkedAt: 2000,
      revocationEpochs: { [mandateId]: 1 },
    };
    const result = verifyMandate(signed, resolver, 2000, 0, statusSnapshot);
    expect(result.valid).toBe(false);
    expect(result.mandateRevoked).toBe(true);
  });
});
