/**
 * RFC-017 end-to-end demonstration:
 *   decision → authorization → execution → settlement, plus crash recovery.
 *
 * One run exercises the whole evidence chain: a semantic DecisionReceipt is
 * linked (via a verified DecisionRef) into a governed payment action that is
 * authorized, executed and settled; a second run simulates a crash between
 * reservation and settlement and is recovered explicitly.
 */

import { createEdgeActionRegistry } from '../action-registry.js';
import { createBuiltinActionDefinitions } from '../actions.js';
import { createAgentEdgeRuntime } from '../agent-runtime.js';
import { createCapabilitySet } from '../capabilities.js';
import type { EdgeRuntimePorts } from '../ports.js';
import {
  GrantBoundAutonomyPolicy,
  MemoryRunStateStore,
  type AutonomyProfile,
  type CanonicalAgentAction,
} from '@totemsdk/agent-policy';
import type { AuthorityIdentityResolver } from '@totemsdk/authority';
import { createAgentMandate } from '@totemsdk/authority';
import type { SignedProof } from '@totemsdk/proof';
import { createProof, signProof } from '@totemsdk/proof';
import { createIdentityDocument, createDelegationClaim, signIdentityClaim } from '@totemsdk/identity';
import { wotsKeypairFromSeed, scriptFromWotsPk, scriptToAddress } from '@totemsdk/core';
import { createDecisionRuntime, toDecisionRef, toDecisionRefRecord } from '@totemsdk/decision';
import type {
  DecisionProvider,
  DecisionProviderOutcome,
  DecisionProviderRequest,
  DecisionResult,
  QuestionDecisionRequest,
} from '@totemsdk/decision';
import { createMockDecisionProvider } from '@totemsdk/decision/testing';

// ── fixtures ────────────────────────────────────────────────────────────────

function testSeed(n: number): Uint8Array {
  const s = new Uint8Array(32);
  s[0] = n & 0xff;
  return s;
}
function deriveAddress(seed: Uint8Array, keyIndex: number): string {
  const kp = wotsKeypairFromSeed(seed, keyIndex);
  return scriptToAddress(scriptFromWotsPk(kp.pk));
}
const SEED_ROOT = testSeed(400);
const SEED_CTRL = testSeed(401);
const SEED_AGENT = testSeed(403);
const ADDR_ROOT = deriveAddress(SEED_ROOT, 0);
const ADDR_AGENT = deriveAddress(SEED_AGENT, 0);

let PRINCIPAL_ID = 'PRINCIPAL';
let clock = 1000;

async function makeResolver() {
  const rootAddr = deriveAddress(SEED_ROOT, 0);
  const ctrlAddr = deriveAddress(SEED_CTRL, 0);
  const doc = createIdentityDocument({ kind: 'agent', rootAddress: rootAddr, controllerAddress: ctrlAddr });
  const claim = createDelegationClaim({ issuer: rootAddr, subject: doc.id, delegatedAddress: ADDR_AGENT, scopes: ['authority:grant'], issuedAt: 1000 });
  const signed = await signIdentityClaim(claim, SEED_ROOT, 0);
  const graph = { document: doc, claims: [signed] };
  return { resolver: { resolve: (id: string) => (id === doc.id ? graph : undefined) } as AuthorityIdentityResolver, identityId: doc.id };
}

function makeMandateProof(identityId: string, scope: string): SignedProof {
  const mandate = createAgentMandate({
    grantor: ADDR_ROOT,
    grantee: ADDR_AGENT,
    principal: identityId,
    scope,
    usageLimit: { maxCount: 100 },
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

const PROFILE: AutonomyProfile = {
  profileId: 'edge-agent',
  mode: 'dynamic',
  runLimits: {
    maxSteps: 20,
    maxParallel: 1,
    maxFailures: 3,
    maxDurationMs: 3_600_000,
    maxGrossSpend: { tokenId: '0x00', amount: '500' },
    maxFees: { tokenId: '0x00', amount: '10' },
  },
  boundaryFailure: 'request_narrow_grant',
};

async function makePolicy(runId: string): Promise<GrantBoundAutonomyPolicy> {
  const { resolver, identityId } = await makeResolver();
  PRINCIPAL_ID = identityId;
  const mandate = makeMandateProof(identityId, '*');
  const policy = new GrantBoundAutonomyPolicy({
    autonomyProfiles: { 'edge-agent': PROFILE },
    mandateResolver: async (id) => (id === 'totem:mandate:owner' ? mandate : undefined),
    identityResolver: resolver,
    stateStore: new MemoryRunStateStore({ now: () => clock }),
    now: () => clock,
  });
  await policy.openRun({ runId, agentId: ADDR_AGENT, principal: PRINCIPAL_ID, grantProofIds: ['totem:mandate:owner'], profileId: 'edge-agent' });
  return policy;
}

function makePorts(): EdgeRuntimePorts {
  return {
    payment: { pay: jest.fn().mockResolvedValue({ ok: true, data: { txpowId: 'tx-1' } }) },
  };
}

function decisionProvider(): DecisionProvider {
  return createMockDecisionProvider({
    id: 'rec-provider',
    decide: (req: DecisionProviderRequest): DecisionProviderOutcome => ({
      ok: true,
      requestId: req.requestId,
      decision: { kind: 'questions', answers: [{ type: 'choice', questionId: 'q1', selected: 'heat' }] } as DecisionResult,
    }),
  });
}

function makeRuntime(policy: GrantBoundAutonomyPolicy, ports: EdgeRuntimePorts) {
  const registry = createEdgeActionRegistry();
  for (const { action, def } of createBuiltinActionDefinitions(ports)) {
    registry.register(def, action);
  }
  return createAgentEdgeRuntime({
    deviceId: 'dev-1',
    capabilities: createCapabilitySet(['payment:send']),
    registry,
    policy,
    runId: 'run-1',
    principal: PRINCIPAL_ID,
    agentId: ADDR_AGENT,
  });
}

// ── suite ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  clock = 1000;
});

describe('RFC-017 decision → authorization → execution → settlement', () => {
  it('links a verified semantic decision into a settled governed payment', async () => {
    // 1. Semantic decision.
    const decisionRuntime = createDecisionRuntime({ routes: [{ provider: decisionProvider() }] });
    const request: QuestionDecisionRequest = {
      kind: 'questions',
      requestId: 'req-1',
      state: { temperature: 21 },
      questions: [{ type: 'choice', id: 'q1', criteria: [{ id: 'heat' }, { id: 'cool' }] }],
    };
    const decision = await decisionRuntime.decide(request);
    if (!decision.ok) throw new Error('decision failed');

    // 2. Application handoff: a verified ref, never an execution token.
    const decisionRef = toDecisionRefRecord(toDecisionRef(decision), decision.receipt);
    expect(decisionRef.verification).toBe('verified');

    // 3. Governed action: authorize → execute → settle.
    const policy = await makePolicy('run-1');
    const runtime = makeRuntime(policy, makePorts());
    const result = await runtime.executeAction({
      action: 'payment:send',
      subject: 'MxSUPPLIER',
      payload: { amount: '10' },
      decisionRef,
    });
    expect(result.ok).toBe(true);

    // 4. The run graph links decision → authority → execution → settlement.
    const graph = await policy.getRunReceiptGraph('run-1');
    expect(graph?.totals.committedSteps).toBe(1);
    expect(graph?.totals.spentByToken['0x00']).toBe('10');

    const step = graph?.stepReceipts[0];
    expect(step?.evidence?.decisionRef).toEqual(decisionRef);
    expect(step?.evidence?.decisionRef?.receiptId).toBe(decision.receipt.receiptId);
    // Authority decision ids stay a separate namespace from the semantic ref.
    expect(step?.decisionIds ?? []).not.toContain(decision.receipt.receiptId);
  });

  it('holds and recovers a reservation that crashed before settlement', async () => {
    const decisionRuntime = createDecisionRuntime({ routes: [{ provider: decisionProvider() }] });
    const decision = await decisionRuntime.decide({
      kind: 'questions',
      requestId: 'req-2',
      state: { temperature: 21 },
      questions: [{ type: 'choice', id: 'q1', criteria: [{ id: 'heat' }] }],
    });
    if (!decision.ok) throw new Error('decision failed');
    const decisionRef = toDecisionRefRecord(toDecisionRef(decision), decision.receipt);

    const policy = await makePolicy('run-2');
    const action: CanonicalAgentAction = {
      action: 'payment:send',
      principal: PRINCIPAL_ID,
      agent: ADDR_AGENT,
      target: 'MxSUPPLIER',
      effects: { spends: [{ tokenId: '0x00', amount: '25' }], fees: [], channels: [] },
      runId: 'run-2',
      stepId: 'pay-1',
      nonce: 'pay-1',
    };

    // Reservation taken, then the executor crashes before settling.
    const auth = await policy.authorizeAndReserve({
      runId: 'run-2',
      stepId: 'pay-1',
      nonce: 'pay-1',
      action,
      evidence: { decisionRef },
    });
    expect(auth.outcome).toBe('approved');
    if (auth.outcome !== 'approved') return;

    clock = 200_000;
    const unsettled = await policy.recoverReservations('run-2');
    expect(unsettled).toHaveLength(1);
    expect(unsettled[0]).toMatchObject({ reservationId: auth.reservationId, kind: 'run' });

    // No expiry restores budget: settlement is an explicit host decision.
    const mid = await policy.getRunReceiptGraph('run-2');
    expect(mid?.totals.committedSteps).toBe(0);
    expect(mid?.totals.reservedSteps).toBe(1);

    await policy.reconcileReservation(auth.reservationId, 'completed');

    const graph = await policy.getRunReceiptGraph('run-2');
    expect(graph?.totals.committedSteps).toBe(1);
    expect(graph?.totals.reservedSteps).toBe(0);
    expect(graph?.totals.spentByToken['0x00']).toBe('25');
    // The decision link survives the crash and reconciliation.
    expect(graph?.stepReceipts[0].evidence?.decisionRef?.receiptId).toBe(decision.receipt.receiptId);
    expect(await policy.recoverReservations('run-2')).toHaveLength(0);
  });
});
