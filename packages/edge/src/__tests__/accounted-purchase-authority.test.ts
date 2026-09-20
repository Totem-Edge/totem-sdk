/**
 * Accounted purchase authority conformance (RFC-007 Phase 5).
 *
 * Purchase entitlements and authority checks stay ABOVE the storage backend
 * and reuse the agent-policy mandate/usage accounting authority
 * (`GrantBoundPolicy` over `GrantUsageStore`) — there is no second accounting
 * layer. These tests prove the authority conformance:
 *
 *   - approval atomically reserves mandate usage (above the backend);
 *   - commit consumes budget exactly once; abort releases exactly once;
 *   - a purchase outside mandate scope/constraints is denied with NO reservation;
 *   - exhausted budget denies the next purchase (the SAME counter, not a new one);
 *   - a crash leaves the reservation `unknown` with budget HELD; only an
 *     explicit `'definitely-not-executed'` reconcile releases it, and
 *     `'completed'` consumes it.
 */

import { GrantBoundPolicy, MemoryGrantUsageStore } from '@totemsdk/agent-policy';
import type { AutonomousRun } from '@totemsdk/agent-policy';
import { createAgentMandate, type AuthorityIdentityResolver, type MandateConstraint } from '@totemsdk/authority';
import { createIdentityDocument, createDelegationClaim, signIdentityClaim } from '@totemsdk/identity';
import { createProof, signProof, type SignedProof } from '@totemsdk/proof';
import { wotsKeypairFromSeed, scriptFromWotsPk, scriptToAddress } from '@totemsdk/core';

import { createAccountedPurchaseAuthority } from '../purchasing/accounted-authority.js';
import type { PurchaseIntent, TradeAgreement } from '../purchasing/types.js';

const SELLER = 'MxSELLER00000000000000000000000000000000000000000000000000000000';
const MANDATE_ID = 'totem:mandate:test';

function testSeed(n: number): Uint8Array {
  const s = new Uint8Array(32);
  s[0] = n & 0xff;
  s[1] = (n >> 8) & 0xff;
  return s;
}

function deriveAddress(seed: Uint8Array, keyIndex: number): string {
  const kp = wotsKeypairFromSeed(seed, keyIndex);
  return scriptToAddress(scriptFromWotsPk(kp.pk));
}

const SEED_ROOT = testSeed(200);
const SEED_CTRL = testSeed(201);
const SEED_AGENT = testSeed(203);
const ADDR_ROOT = deriveAddress(SEED_ROOT, 0);
const ADDR_AGENT = deriveAddress(SEED_AGENT, 0);

async function makeIdentityGraph() {
  const rootAddr = deriveAddress(SEED_ROOT, 0);
  const ctrlAddr = deriveAddress(SEED_CTRL, 0);
  const doc = createIdentityDocument({ kind: 'agent', rootAddress: rootAddr, controllerAddress: ctrlAddr });
  const claim = createDelegationClaim({
    issuer: rootAddr,
    subject: doc.id,
    delegatedAddress: ADDR_AGENT,
    scopes: ['authority:grant'],
    issuedAt: 1000,
  });
  const signed = await signIdentityClaim(claim, SEED_ROOT, 0);
  return { graph: { document: doc, claims: [signed] }, identityId: doc.id };
}

function makeResolver(graphs: Map<string, unknown>): AuthorityIdentityResolver {
  return { resolve: (id) => graphs.get(id) as never };
}

function makePurchaseMandate(identityId: string, maxCount: number): SignedProof {
  const constraints: MandateConstraint[] = [
    { field: 'action', operator: 'eq', value: 'purchase.pay' },
    { field: 'target', operator: 'eq', value: SELLER },
  ];
  const mandate = createAgentMandate({
    grantor: ADDR_ROOT,
    grantee: ADDR_AGENT,
    principal: identityId,
    scope: 'purchase.pay',
    constraints,
    usageLimit: { maxCount },
    issuedAt: 0,
  });
  const unsigned = createProof({
    kind: 'custom',
    subject: { id: mandate.grantee, kind: 'agent' },
    issuer: mandate.grantor,
    issuedAt: mandate.issuedAt,
    expiresAt: mandate.expiresAt,
    payload: { schema: 'totem:authority:mandate/v1', mandate },
  });
  return signProof(unsigned, SEED_ROOT, 0);
}

function makeRun(identityId: string): AutonomousRun {
  return {
    runId: 'purchase-run-1',
    agentId: ADDR_AGENT,
    principal: identityId,
    startedAt: 2000,
    mode: 'dynamic',
    grantProofIds: [MANDATE_ID],
  };
}

function agreement(overrides?: Partial<TradeAgreement>): TradeAgreement {
  return {
    version: 1,
    agreementId: 'agr-1',
    negotiationId: 'neg-1',
    acceptedProposalId: 'prop-1',
    manifestId: 'man-1',
    buyer: ADDR_AGENT,
    seller: SELLER,
    terms: { price: '100', tokenId: '0x00', paymentMethod: 'omnia' },
    agreedAt: 1500,
    buyerSignature: 'sig-buyer',
    sellerSignature: 'sig-seller',
    ...overrides,
  };
}

const INTENT: PurchaseIntent = { id: 'intent-1', resource: 'gpu-hour' };

describe('createAccountedPurchaseAuthority — mandate/budget reuse (RFC-007 Phase 5)', () => {
  let clock: number;

  async function makeAuthority(maxCount = 2) {
    const { graph, identityId } = await makeIdentityGraph();
    const resolver = makeResolver(new Map([[identityId, graph]]));
    const now = () => clock;
    const usageStore = new MemoryGrantUsageStore({ now });
    const mandate = makePurchaseMandate(identityId, maxCount);
    const grantBound = new GrantBoundPolicy({
      mandateResolver: async (id) => (id === MANDATE_ID ? mandate : undefined),
      identityResolver: resolver,
      usageStore,
      localBounds: { maxSteps: 5, maxParallelSteps: 2, maxFailures: 2 },
      now,
    });
    const run = makeRun(identityId);
    const authority = createAccountedPurchaseAuthority({ grantBound, usageStore, run, now });
    return { authority, usageStore, run, identityId };
  }

  beforeEach(() => {
    clock = 2000;
  });

  it('approval reserves mandate usage atomically (above the backend)', async () => {
    const { authority } = await makeAuthority();
    const r = await authority.approve({ agreement: agreement(), intent: INTENT });

    expect(r.ok).toBe(true);
    expect(r.data?.allowed).toBe(true);
    expect(r.data?.reservationId).toBeTruthy();
    expect(r.data?.mandateId).toBe(MANDATE_ID);
    // Budget is HELD while the reservation is live — read from the same authority.
    const counts = await authority.counts();
    expect(counts.reserved).toBe(1);
    expect(counts.committed).toBe(0);
  });

  it('commit consumes budget exactly once', async () => {
    const { authority } = await makeAuthority();
    const r = await authority.approve({ agreement: agreement(), intent: INTENT });
    await authority.commit(r.data!.reservationId!, { txpowId: '0xabc' });

    const counts = await authority.counts();
    expect(counts.committed).toBe(1);
    expect(counts.reserved).toBe(0);
  });

  it('abort releases budget exactly once (never restores it twice)', async () => {
    const { authority } = await makeAuthority();
    const r = await authority.approve({ agreement: agreement(), intent: INTENT });
    await authority.abort(r.data!.reservationId!, 'purchase cancelled');

    const counts = await authority.counts();
    expect(counts.aborted).toBe(1);
    expect(counts.committed).toBe(0);
    expect(counts.reserved).toBe(0);
  });

  it('denies a purchase outside mandate constraints with NO reservation', async () => {
    const { authority } = await makeAuthority();
    const wrongSeller = agreement({ agreementId: 'agr-wrong', seller: 'MxSOMEONE-ELSE' });
    const r = await authority.approve({ agreement: wrongSeller, intent: INTENT });

    expect(r.ok).toBe(true);
    expect(r.data?.allowed).toBe(false);
    expect(r.data?.reservationId).toBeUndefined();
    expect((await authority.counts()).reserved).toBe(0);
  });

  it('exhausted budget denies the next purchase through the SAME counter', async () => {
    const { authority } = await makeAuthority(1);
    const first = await authority.approve({ agreement: agreement({ agreementId: 'agr-1' }), intent: INTENT });
    expect(first.data?.allowed).toBe(true);
    await authority.commit(first.data!.reservationId!);

    const second = await authority.approve({ agreement: agreement({ agreementId: 'agr-2' }), intent: INTENT });
    expect(second.data?.allowed).toBe(false);
    // Only the committed purchase ever counted — no rival counter.
    expect((await authority.counts()).committed).toBe(1);
    expect((await authority.counts()).reserved).toBe(0);
  });

  it('commit after expiry leaves the reservation outcome-unknown with budget HELD', async () => {
    const { authority } = await makeAuthority();
    const r = await authority.approve({ agreement: agreement(), intent: INTENT });
    clock += 120_000; // past the 60s reservation TTL

    await expect(authority.commit(r.data!.reservationId!)).rejects.toThrow(/expired/);
    const counts = await authority.counts();
    expect(counts.unknown).toBe(1);
    expect(counts.committed).toBe(0);
    expect(counts.reserved).toBe(0);
  });

  it("reconcile 'definitely-not-executed' is the only way unknown budget is released", async () => {
    const { authority } = await makeAuthority();
    const r = await authority.approve({ agreement: agreement(), intent: INTENT });
    clock += 120_000;

    const unsettled = await authority.recover();
    expect(unsettled.map((u) => u.reservationId)).toContain(r.data!.reservationId);
    expect((await authority.counts()).unknown).toBe(1);

    await authority.reconcile(r.data!.reservationId!, 'definitely-not-executed', { reason: 'process died' });
    const counts = await authority.counts();
    expect(counts.unknown).toBe(0);
    expect(counts.aborted).toBe(1);
    expect(counts.committed).toBe(0);
  });

  it("reconcile 'completed' consumes the recovered reservation", async () => {
    const { authority } = await makeAuthority();
    const r = await authority.approve({ agreement: agreement(), intent: INTENT });
    clock += 120_000;
    await authority.recover();

    await authority.reconcile(r.data!.reservationId!, 'completed');
    const counts = await authority.counts();
    expect(counts.committed).toBe(1);
    expect(counts.unknown).toBe(0);
  });
});
