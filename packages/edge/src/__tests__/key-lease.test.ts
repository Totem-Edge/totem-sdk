/**
 * edge/__tests__/key-lease.test.ts — Key-lease as an internal consequence of
 * authorized signing actions; ungrantable guard hardening.
 */

import { createBuiltinActionDefinitions } from '../actions.js';
import { createEdgeActionRegistry, isUngrantableAction } from '../action-registry.js';
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
const SEED_ROOT = testSeed(600);
const SEED_CTRL = testSeed(601);
const SEED_AGENT = testSeed(603);
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
    payment: { pay: jest.fn().mockResolvedValue({ ok: true, data: { txpowId: 'tx-1' } }) },
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
    manifest: {
      sign: jest.fn().mockResolvedValue({ ok: true, data: { signed: {} } }),
      verify: jest.fn().mockResolvedValue({ ok: true, data: { valid: true } }),
    },
    keyLease: {
      reserve: jest.fn().mockResolvedValue({ reservationId: 'res-1' }),
      commit: jest.fn().mockResolvedValue(undefined),
      burn: jest.fn().mockResolvedValue(undefined),
    },
    ...overrides,
  };
}

// ── suite ───────────────────────────────────────────────────────────────────

describe('ungrantable guard', () => {
  it('flags all key-lease and raw-signing operations', () => {
    expect(isUngrantableAction('keylease:reserve')).toBe(true);
    expect(isUngrantableAction('keylease:commit')).toBe(true);
    expect(isUngrantableAction('keylease:burn')).toBe(true);
    expect(isUngrantableAction('signing:raw')).toBe(true);
    expect(isUngrantableAction('wallet:seed-export')).toBe(true);
    expect(isUngrantableAction('wallet:private-key')).toBe(true);
    expect(isUngrantableAction('identity:root-rotate')).toBe(true);
    expect(isUngrantableAction('policy:replace')).toBe(true);
    expect(isUngrantableAction('port:raw')).toBe(true);
  });

  it('rejects key-lease actions even when a keyLease port exists', async () => {
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

    const result = await runtime.executeAction({ action: 'keylease:reserve', subject: 'MxR', payload: { keyIndex: 0 } });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('UNGRANTABLE_ACTION');
    expect(ports.keyLease?.reserve).not.toHaveBeenCalled();
  });
});

describe('key-lease as internal consequence', () => {
  it('reserves → signs → commits for a manifest:sign action', async () => {
    const policy = await makePolicy();
    const ports = makePorts();
    const registry = createEdgeActionRegistry();
    const trusted = { manifestSeed: new Uint8Array(32).fill(7), manifestKeyIndex: 3 };
    for (const { action, def } of createBuiltinActionDefinitions(ports, trusted)) {
      registry.register(def, action);
    }
    const runtime = createAgentEdgeRuntime({
      deviceId: 'dev-1',
      capabilities: createCapabilitySet(['manifest:sign']),
      registry,
      policy,
      runId: 'run-1',
      principal: 'PRINCIPAL',
      agentId: 'ag',
    });

    const result = await runtime.executeAction({ action: 'manifest:sign', subject: 'MxR', payload: { manifest: { type: 'edge-service' } } });
    expect(result.ok).toBe(true);
    expect(ports.keyLease?.reserve).toHaveBeenCalledWith(3);
    expect(ports.keyLease?.commit).toHaveBeenCalledWith('res-1');
    expect(ports.keyLease?.burn).not.toHaveBeenCalled();
    expect(ports.manifest?.sign).toHaveBeenCalledWith({ type: 'edge-service' }, trusted.manifestSeed, 3);
  });

  it('burns the reservation when the signing port fails', async () => {
    const policy = await makePolicy();
    const ports = makePorts({
      manifest: {
        sign: jest.fn().mockRejectedValue(new Error('signing failed')),
        verify: jest.fn(),
      },
    });
    const registry = createEdgeActionRegistry();
    const trusted = { manifestSeed: new Uint8Array(32).fill(7), manifestKeyIndex: 3 };
    for (const { action, def } of createBuiltinActionDefinitions(ports, trusted)) {
      registry.register(def, action);
    }
    const runtime = createAgentEdgeRuntime({
      deviceId: 'dev-1',
      capabilities: createCapabilitySet(['manifest:sign']),
      registry,
      policy,
      runId: 'run-1',
      principal: 'PRINCIPAL',
      agentId: 'ag',
    });

    const result = await runtime.executeAction({ action: 'manifest:sign', subject: 'MxR', payload: { manifest: {} } });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('EXECUTION_FAILED');
    expect(ports.keyLease?.reserve).toHaveBeenCalledWith(3);
    expect(ports.keyLease?.burn).toHaveBeenCalledWith('res-1');
    expect(ports.keyLease?.commit).not.toHaveBeenCalled();
  });

  it('burns the reservation when the port returns ok:false', async () => {
    const policy = await makePolicy();
    const ports = makePorts({
      manifest: {
        sign: jest.fn().mockResolvedValue({ ok: false, error: 'rejected', errorCode: 'SIGN_REJECTED' }),
        verify: jest.fn(),
      },
    });
    const registry = createEdgeActionRegistry();
    const trusted = { manifestSeed: new Uint8Array(32).fill(7), manifestKeyIndex: 3 };
    for (const { action, def } of createBuiltinActionDefinitions(ports, trusted)) {
      registry.register(def, action);
    }
    const runtime = createAgentEdgeRuntime({
      deviceId: 'dev-1',
      capabilities: createCapabilitySet(['manifest:sign']),
      registry,
      policy,
      runId: 'run-1',
      principal: 'PRINCIPAL',
      agentId: 'ag',
    });

    const result = await runtime.executeAction({ action: 'manifest:sign', subject: 'MxR', payload: { manifest: {} } });
    expect(result.ok).toBe(false);
    expect(ports.keyLease?.burn).toHaveBeenCalledWith('res-1');
    expect(ports.keyLease?.commit).not.toHaveBeenCalled();
  });

  it('wraps omnia spend ops in the key-lease lifecycle', async () => {
    const policy = await makePolicy();
    const ports = makePorts();
    const registry = createEdgeActionRegistry();
    const trusted = { signingKeyIndex: 5 };
    for (const { action, def } of createBuiltinActionDefinitions(ports, trusted)) {
      registry.register(def, action);
    }
    const runtime = createAgentEdgeRuntime({
      deviceId: 'dev-1',
      capabilities: createCapabilitySet(['omnia:routing']),
      registry,
      policy,
      runId: 'run-1',
      principal: 'PRINCIPAL',
      agentId: 'ag',
    });

    const result = await runtime.executeAction({
      action: 'omnia:pay',
      subject: 'MxR',
      payload: { amount: '10', tokenId: '0x00', channelId: 'ch-1' },
    });
    expect(result.ok).toBe(true);
    expect(ports.keyLease?.reserve).toHaveBeenCalledWith(5);
    expect(ports.keyLease?.commit).toHaveBeenCalledWith('res-1');
    expect(ports.omnia?.pay).toHaveBeenCalled();
  });

  it('does not wrap read-effect omnia ops in the key-lease lifecycle', async () => {
    const policy = await makePolicy();
    const ports = makePorts();
    const registry = createEdgeActionRegistry();
    const trusted = { signingKeyIndex: 5 };
    for (const { action, def } of createBuiltinActionDefinitions(ports, trusted)) {
      registry.register(def, action);
    }
    const runtime = createAgentEdgeRuntime({
      deviceId: 'dev-1',
      capabilities: createCapabilitySet(['omnia:routing']),
      registry,
      policy,
      runId: 'run-1',
      principal: 'PRINCIPAL',
      agentId: 'ag',
    });

    const result = await runtime.executeAction({ action: 'omnia:route', subject: 'MxR' });
    expect(result.ok).toBe(true);
    expect(ports.keyLease?.reserve).not.toHaveBeenCalled();
  });
});
