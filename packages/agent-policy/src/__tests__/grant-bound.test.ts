import { GrantBoundPolicy, resolveStepField } from '../grant-bound.js';
import { MemoryGrantUsageStore } from '../grant-usage.js';
import type { AgentStep, AutonomousRun } from '../run.js';
import { createAgentMandate, type AuthorityIdentityResolver, type MandateConstraint } from '@totemsdk/authority';
import type { SignedProof } from '@totemsdk/proof';
import { createIdentityDocument, createDelegationClaim, signIdentityClaim } from '@totemsdk/identity';
import { createProof, signProof } from '@totemsdk/proof';
import { wotsKeypairFromSeed, scriptFromWotsPk, scriptToAddress } from '@totemsdk/core';

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

const SEED_ROOT = testSeed(100);
const SEED_CTRL = testSeed(101);
const SEED_AGENT = testSeed(103);
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

function makeMandateProof(identityId: string, overrides?: { scope?: string; constraints?: MandateConstraint[] }): SignedProof {
  const mandate = createAgentMandate({
    grantor: ADDR_ROOT,
    grantee: ADDR_AGENT,
    principal: identityId,
    scope: overrides?.scope ?? 'rebalance',
    constraints: overrides?.constraints ?? [
      { field: 'target', operator: 'eq', value: 'channel-7' },
      { field: 'payload.channel', operator: 'eq', value: 'ch-9' },
    ],
    usageLimit: { maxCount: 3 },
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

function makeRun(identityId: string, overrides?: Partial<AutonomousRun>): AutonomousRun {
  return {
    runId: 'run-1',
    agentId: 'agent-1',
    principal: identityId,
    startedAt: 1000,
    mode: 'dynamic',
    grantProofIds: ['totem:mandate:test'],
    ...overrides,
  };
}

function makeStep(identityId: string, overrides?: Partial<AgentStep>): AgentStep {
  return {
    runId: 'run-1',
    stepId: 'step-1',
    sequence: 1,
    action: {
      action: 'rebalance',
      principal: identityId,
      agent: 'agent-1',
      target: 'channel-7',
      constraints: { amount: '100', payload: { channel: 'ch-9' } },
      nonce: 'step-1',
    },
    ...overrides,
  };
}

describe('resolveStepField', () => {
  it('resolves top-level step fields', () => {
    const step = makeStep('id-1');
    expect(resolveStepField(step, 'runId')).toBe('run-1');
    expect(resolveStepField(step, 'stepId')).toBe('step-1');
    expect(resolveStepField(step, 'sequence')).toBe(1);
    expect(resolveStepField(step, 'target')).toBe('channel-7');
  });

  it('resolves dotted constraint paths', () => {
    const step = makeStep('id-1');
    expect(resolveStepField(step, 'payload.channel')).toBe('ch-9');
    expect(resolveStepField(step, 'amount')).toBe('100');
    expect(resolveStepField(step, 'payload.missing')).toBeUndefined();
  });
});

describe('GrantBoundPolicy', () => {
  async function makePolicy(overrides?: Partial<ConstructorParameters<typeof GrantBoundPolicy>[0]>) {
    const { graph, identityId } = await makeIdentityGraph();
    const resolver = makeResolver(new Map([[identityId, graph]]));
    const store = new MemoryGrantUsageStore({ now: () => 2000 });
    const mandate = makeMandateProof(identityId);
    const policy = new GrantBoundPolicy({
      mandateResolver: async (id) => (id === 'totem:mandate:test' ? mandate : undefined),
      identityResolver: resolver,
      usageStore: store,
      localBounds: { maxSteps: 3, maxParallelSteps: 2, maxFailures: 2 },
      now: () => 2000,
      ...overrides,
    });
    return { policy, store, mandate, identityId };
  }

  it('authorizes a step within mandate scope and constraints', async () => {
    const { policy, identityId } = await makePolicy();
    const result = await policy.authorizeStep(makeRun(identityId), makeStep(identityId));
    expect(result.allowed).toBe(true);
    expect(result.matchedMandateId).toBe('totem:mandate:test');
    expect(result.reservation?.runId).toBe('run-1');
    expect(result.reservation?.stepId).toBe('step-1');
  });

  it('rejects a step outside mandate constraints', async () => {
    const { policy, identityId } = await makePolicy();
    const step = makeStep(identityId, { action: { ...makeStep(identityId).action, target: 'channel-9' } });
    const result = await policy.authorizeStep(makeRun(identityId), step);
    expect(result.allowed).toBe(false);
  });

  it('enforces maxSteps local bound', async () => {
    const { policy, identityId } = await makePolicy();
    for (let i = 0; i < 3; i++) {
      const step = makeStep(identityId, { stepId: `step-${i}`, sequence: i + 1 });
      const result = await policy.authorizeStep(makeRun(identityId), step);
      expect(result.allowed).toBe(true);
      await policy.commitStep(result.reservation!.reservationId);
    }
    const over = await policy.authorizeStep(makeRun(identityId), makeStep(identityId, { stepId: 'step-4', sequence: 4 }));
    expect(over.allowed).toBe(false);
    expect(over.reason).toContain('maxSteps');
  });

  it('enforces maxParallelSteps local bound', async () => {
    const { policy, identityId } = await makePolicy();
    const a = await policy.authorizeStep(makeRun(identityId), makeStep(identityId, { stepId: 'a' }));
    const b = await policy.authorizeStep(makeRun(identityId), makeStep(identityId, { stepId: 'b' }));
    expect(a.allowed).toBe(true);
    expect(b.allowed).toBe(true);
    const c = await policy.authorizeStep(makeRun(identityId), makeStep(identityId, { stepId: 'c' }));
    expect(c.allowed).toBe(false);
    expect(c.reason).toContain('maxParallelSteps');
  });

  it('enforces maxFailures local bound', async () => {
    const { policy, identityId } = await makePolicy();
    for (let i = 0; i < 2; i++) {
      const step = makeStep(identityId, { stepId: `f-${i}` });
      const result = await policy.authorizeStep(makeRun(identityId), step);
      await policy.abortStep(result.reservation!.reservationId, 'failed');
    }
    const over = await policy.authorizeStep(makeRun(identityId), makeStep(identityId, { stepId: 'f-3' }));
    expect(over.allowed).toBe(false);
    expect(over.reason).toContain('maxFailures');
  });

  it('enforces maxRunDurationMs local bound', async () => {
    const { policy, identityId } = await makePolicy({
      localBounds: { maxRunDurationMs: 500 },
    });
    const run = makeRun(identityId, { startedAt: 0 });
    const result = await policy.authorizeStep(run, makeStep(identityId));
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('maxRunDurationMs');
  });

  it('commits and aborts reservations atomically', async () => {
    const { policy, store, identityId } = await makePolicy();
    const result = await policy.authorizeStep(makeRun(identityId), makeStep(identityId));
    expect(result.allowed).toBe(true);
    await policy.commitStep(result.reservation!.reservationId, { txpowId: '0xabc' });
    expect(await store.countCommitted('run-1')).toBe(1);

    const second = await policy.authorizeStep(makeRun(identityId), makeStep(identityId, { stepId: 's2' }));
    await policy.abortStep(second.reservation!.reservationId, 'execution failed');
    expect(await store.countAborted('run-1')).toBe(1);
  });

  it('returns requires_human when no mandate matches and unmatchedAction is requires_human', async () => {
    const { policy, identityId } = await makePolicy();
    const run = makeRun(identityId, { grantProofIds: ['totem:mandate:none'] });
    const result = await policy.authorizeStep(run, makeStep(identityId));
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('requires human');
  });
});