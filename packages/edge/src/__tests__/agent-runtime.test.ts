/**
 * edge/__tests__/agent-runtime.test.ts — Governed agent facade + action registry.
 */

import { createEdgeActionRegistry, isUngrantableAction, UNGRANTABLE_ACTIONS } from '../action-registry.js';
import { createBuiltinActionDefinitions } from '../actions.js';
import { createAgentEdgeRuntime } from '../agent-runtime.js';
import { createCapabilitySet } from '../capabilities.js';
import type { EdgeRuntimePorts } from '../ports.js';
import {
  GrantBoundAutonomyPolicy,
  MemoryRunStateStore,
  type AutonomyProfile,
} from '@totemsdk/agent-policy';
import type { AuthorityIdentityResolver } from '@totemsdk/authority';
import type { SignedProof } from '@totemsdk/proof';
import { createAgentMandate } from '@totemsdk/authority';
import { createProof, signProof } from '@totemsdk/proof';
import { createIdentityDocument, createDelegationClaim, signIdentityClaim } from '@totemsdk/identity';
import { wotsKeypairFromSeed, scriptFromWotsPk, scriptToAddress } from '@totemsdk/core';

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

async function makePolicy() {
  const { resolver, identityId } = await makeResolver();
  const mandate = makeMandateProof(identityId, '*');
  const policy = new GrantBoundAutonomyPolicy({
    autonomyProfiles: { 'edge-agent': PROFILE },
    mandateResolver: async (id) => (id === 'totem:mandate:owner' ? mandate : undefined),
    identityResolver: resolver,
    stateStore: new MemoryRunStateStore({ now: () => 1000 }),
    now: () => 1000,
  });
  await policy.openRun({ runId: 'run-1', agentId: 'ag', principal: 'PRINCIPAL', grantProofIds: ['totem:mandate:owner'], profileId: 'edge-agent' });
  return policy;
}

function makePorts(overrides: Partial<EdgeRuntimePorts> = {}): EdgeRuntimePorts {
  return {
    payment: {
      pay: jest.fn().mockResolvedValue({ ok: true, data: { txpowId: 'tx-1' } }),
    },
    lookup: {
      lookup: jest.fn().mockResolvedValue({ ok: true, data: { results: [] } }),
      watch: jest.fn(),
      query: jest.fn(),
      announce: jest.fn().mockResolvedValue({ ok: true }),
    },
    proof: {
      createProof: jest.fn().mockResolvedValue({ ok: true, data: { proofId: 'p-1', proof: {} } }),
      verifyProof: jest.fn().mockResolvedValue({ ok: true, data: { valid: true } }),
    },
    omnia: {
      getChannels: jest.fn().mockResolvedValue({ ok: true, data: { channels: [] } }),
      openChannel: jest.fn().mockResolvedValue({ ok: true }),
      pay: jest.fn().mockResolvedValue({ ok: true }),
      settle: jest.fn().mockResolvedValue({ ok: true }),
      closeChannel: jest.fn().mockResolvedValue({ ok: true }),
      getRoute: jest.fn().mockResolvedValue({ ok: true }),
      payMultiHop: jest.fn().mockResolvedValue({ ok: true }),
      getSwapRate: jest.fn().mockResolvedValue({ ok: true }),
      createFactory: jest.fn().mockResolvedValue({ ok: true }),
      openVirtualChannel: jest.fn().mockResolvedValue({ ok: true }),
      closeFactory: jest.fn().mockResolvedValue({ ok: true }),
      spliceIn: jest.fn().mockResolvedValue({ ok: true }),
      spliceOut: jest.fn().mockResolvedValue({ ok: true }),
    },
    location: {
      createClaim: jest.fn().mockResolvedValue({ ok: true, data: { claimId: 'c-1', claim: {} } }),
      scoreClaim: jest.fn(),
      createTrail: jest.fn().mockResolvedValue({ ok: true, data: { trailId: 't-1', trail: {} } }),
      createProof: jest.fn().mockResolvedValue({ ok: true, data: { proofId: 'lp-1', proof: {} } }),
      verifyProof: jest.fn(),
    },
    identity: {
      resolve: jest.fn().mockResolvedValue({ ok: true, data: { identity: {} } }),
      verify: jest.fn().mockResolvedValue({ ok: true, data: { valid: true } }),
    },
    manifest: {
      sign: jest.fn().mockResolvedValue({ ok: true, data: { signed: {} } }),
      verify: jest.fn().mockResolvedValue({ ok: true, data: { valid: true } }),
    },
    liquidity: {
      getBalance: jest.fn().mockResolvedValue({ ok: true, data: { balance: '100', tokenId: '0x00' } }),
      getUtxos: jest.fn().mockResolvedValue({ ok: true, data: { utxos: [] } }),
    },
    pubsub: {
      connect: jest.fn(),
      disconnect: jest.fn(),
      subscribe: jest.fn().mockResolvedValue({ topic: 't', unsubscribe: jest.fn() }),
      publish: jest.fn().mockResolvedValue(undefined),
      onMessage: jest.fn(),
    },
    stream: {
      send: jest.fn(),
      onData: jest.fn(),
      onClose: jest.fn(),
      onError: jest.fn(),
      close: jest.fn(),
    },
    ...overrides,
  };
}

// ── suite ───────────────────────────────────────────────────────────────────

describe('action registry', () => {
  it('rejects registration of ungrantable actions', () => {
    const registry = createEdgeActionRegistry();
    expect(() => registry.register({
      capability: 'wallet:seed-export',
      effect: 'admin',
      prepare: () => ({}),
      deriveEffects: () => ({ spends: [], fees: [], channels: [] }),
      execute: async () => ({ ok: true }),
    }, 'wallet:seed-export')).toThrow('ungrantable');
  });

  it('flags ungrantable actions', () => {
    expect(isUngrantableAction('wallet:seed-export')).toBe(true);
    expect(isUngrantableAction('keylease:reserve')).toBe(true);
    expect(isUngrantableAction('identity:root-rotate')).toBe(true);
    expect(isUngrantableAction('payment:send')).toBe(false);
    expect(UNGRANTABLE_ACTIONS).toContain('signing:raw');
  });

  it('resolves exact and prefix actions', () => {
    const registry = createEdgeActionRegistry();
    const def = {
      capability: 'payment:send' as const,
      effect: 'spend' as const,
      prepare: () => ({}),
      deriveEffects: () => ({ spends: [], fees: [], channels: [] }),
      execute: async () => ({ ok: true }),
    };
    registry.register(def, ['payment:send', 'omnia:*']);
    expect(registry.resolve('payment:send')).toBe(def);
    expect(registry.resolve('omnia:pay')).toBe(def);
    expect(registry.resolve('unknown:thing')).toBeUndefined();
  });
});

describe('agent edge runtime', () => {
  it('executes a payment action through the governed facade', async () => {
    const policy = await makePolicy();
    const ports = makePorts();
    const registry = createEdgeActionRegistry();
    for (const { action, def } of createBuiltinActionDefinitions(ports)) {
      registry.register(def, action);
    }
    const runtime = createAgentEdgeRuntime({
      deviceId: 'dev-1',
      capabilities: createCapabilitySet(['payment:send']),
      registry,
      policy,
      runId: 'run-1',
      principal: 'PRINCIPAL',
      agentId: 'ag',
    });

    const result = await runtime.executeAction({
      action: 'payment:send',
      subject: 'MxRECIPIENT',
      payload: { amount: '10', tokenId: '0x00' },
    });
    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ txpowId: 'tx-1' });
    expect(ports.payment?.pay).toHaveBeenCalledWith({ recipient: 'MxRECIPIENT', amount: '10', tokenId: '0x00', memo: undefined });

    const graph = await policy.getRunReceiptGraph('run-1');
    expect(graph?.totals.committedSteps).toBe(1);
  });

  it('rejects an action whose capability is missing', async () => {
    const policy = await makePolicy();
    const ports = makePorts();
    const registry = createEdgeActionRegistry();
    for (const { action, def } of createBuiltinActionDefinitions(ports)) {
      registry.register(def, action);
    }
    const runtime = createAgentEdgeRuntime({
      deviceId: 'dev-1',
      capabilities: createCapabilitySet([]),
      registry,
      policy,
      runId: 'run-1',
      principal: 'PRINCIPAL',
      agentId: 'ag',
    });

    const result = await runtime.executeAction({ action: 'payment:send', subject: 'MxR', payload: { amount: '1' } });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('CAPABILITY_MISSING');
    expect(ports.payment?.pay).not.toHaveBeenCalled();
  });

  it('rejects ungrantable actions before touching any port', async () => {
    const policy = await makePolicy();
    const ports = makePorts();
    const registry = createEdgeActionRegistry();
    for (const { action, def } of createBuiltinActionDefinitions(ports)) {
      registry.register(def, action);
    }
    const runtime = createAgentEdgeRuntime({
      deviceId: 'dev-1',
      capabilities: createCapabilitySet(['wallet:seed-export']),
      registry,
      policy,
      runId: 'run-1',
      principal: 'PRINCIPAL',
      agentId: 'ag',
    });

    const result = await runtime.executeAction({ action: 'wallet:seed-export', subject: 'MxR' });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('UNGRANTABLE_ACTION');
  });

  it('rejects an unknown action', async () => {
    const policy = await makePolicy();
    const registry = createEdgeActionRegistry();
    const runtime = createAgentEdgeRuntime({
      deviceId: 'dev-1',
      capabilities: createCapabilitySet(['payment:send']),
      registry,
      policy,
      runId: 'run-1',
      principal: 'PRINCIPAL',
      agentId: 'ag',
    });

    const result = await runtime.executeAction({ action: 'nonsense:thing', subject: 'MxR' });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('UNKNOWN_ACTION');
  });

  it('aborts the reservation when execution fails', async () => {
    const policy = await makePolicy();
    const ports = makePorts({
      payment: { pay: jest.fn().mockRejectedValue(new Error('insufficient funds')) },
    });
    const registry = createEdgeActionRegistry();
    for (const { action, def } of createBuiltinActionDefinitions(ports)) {
      registry.register(def, action);
    }
    const runtime = createAgentEdgeRuntime({
      deviceId: 'dev-1',
      capabilities: createCapabilitySet(['payment:send']),
      registry,
      policy,
      runId: 'run-1',
      principal: 'PRINCIPAL',
      agentId: 'ag',
    });

    const result = await runtime.executeAction({ action: 'payment:send', subject: 'MxR', payload: { amount: '10' } });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('EXECUTION_FAILED');

    const graph = await policy.getRunReceiptGraph('run-1');
    expect(graph?.totals.abortedSteps).toBe(1);
    expect(graph?.totals.committedSteps).toBe(0);
  });

  it('returns requires_human with a suggested grant when the run ceiling is hit', async () => {
    const policy = await makePolicy();
    const ports = makePorts();
    const registry = createEdgeActionRegistry();
    for (const { action, def } of createBuiltinActionDefinitions(ports)) {
      registry.register(def, action);
    }
    const runtime = createAgentEdgeRuntime({
      deviceId: 'dev-1',
      capabilities: createCapabilitySet(['payment:send']),
      registry,
      policy,
      runId: 'run-1',
      principal: 'PRINCIPAL',
      agentId: 'ag',
    });

    // maxGrossSpend is 500 — a 600 spend exceeds it.
    const result = await runtime.executeAction({ action: 'payment:send', subject: 'MxR', payload: { amount: '600' } });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('REQUIRES_HUMAN');
    expect(result.policyResult?.suggestedGrant?.bindToRunId).toBe('run-1');
    expect(ports.payment?.pay).not.toHaveBeenCalled();
  });

  it('does not expose raw ports to the agent', async () => {
    const policy = await makePolicy();
    const ports = makePorts();
    const registry = createEdgeActionRegistry();
    for (const { action, def } of createBuiltinActionDefinitions(ports)) {
      registry.register(def, action);
    }
    const runtime = createAgentEdgeRuntime({
      deviceId: 'dev-1',
      capabilities: createCapabilitySet(['payment:send']),
      registry,
      policy,
      runId: 'run-1',
      principal: 'PRINCIPAL',
      agentId: 'ag',
    });

    expect((runtime as unknown as Record<string, unknown>).ports).toBeUndefined();
    expect(Object.keys(runtime)).toEqual(['version', 'deviceId', 'executeAction']);
  });
});
