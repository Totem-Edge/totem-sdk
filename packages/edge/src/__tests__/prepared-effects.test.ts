/**
 * edge/__tests__/prepared-effects.test.ts — Effects derived from REAL built
 * transactions, never agent payload hints.
 */

import {
  deriveEffectsFromBuiltTx,
  deriveSpendsFromBuiltTx,
  fromEnhancedBuildParams,
  fromOmniaTxDraft,
} from '../prepared-effects.js';
import { createBuiltinActionDefinitions } from '../actions.js';
import { createEdgeActionRegistry } from '../action-registry.js';
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
const SEED_ROOT = testSeed(500);
const SEED_CTRL = testSeed(501);
const SEED_AGENT = testSeed(503);
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
    ...overrides,
  };
}

// ── suite ───────────────────────────────────────────────────────────────────

describe('deriveSpendsFromBuiltTx', () => {
  it('excludes change back to the wallet own address', () => {
    const spends = deriveSpendsFromBuiltTx({
      inputs: [{ address: 'MxWALLET', amount: '100', tokenId: '0x00' }],
      outputs: [
        { address: 'MxRECIPIENT', amount: '40', tokenId: '0x00' },
        { address: 'MxWALLET', amount: '60', tokenId: '0x00' },
      ],
      ownAddresses: ['MxWALLET'],
    });
    expect(spends).toHaveLength(1);
    expect(spends[0]).toEqual({ tokenId: '0x00', amount: '40', recipient: 'MxRECIPIENT' });
  });

  it('excludes channel-internal outputs back to the channel script', () => {
    const spends = deriveSpendsFromBuiltTx({
      inputs: [{ address: '0xCHANNEL', amount: '1000', tokenId: '0x00' }],
      outputs: [{ address: '0xCHANNEL', amount: '1000', tokenId: '0x00' }],
      ownAddresses: [],
      channelScriptAddress: '0xCHANNEL',
    });
    expect(spends).toHaveLength(0);
  });

  it('counts external settlement outputs as spends', () => {
    const spends = deriveSpendsFromBuiltTx({
      inputs: [{ address: '0xCHANNEL', amount: '1000', tokenId: '0x00' }],
      outputs: [
        { address: '0xCHANNEL', amount: '600', tokenId: '0x00' },
        { address: '0xEXTERNAL', amount: '400', tokenId: '0x00' },
      ],
      ownAddresses: [],
      channelScriptAddress: '0xCHANNEL',
    });
    expect(spends).toHaveLength(1);
    expect(spends[0]).toEqual({ tokenId: '0x00', amount: '400', recipient: '0xEXTERNAL' });
  });
});

describe('fromEnhancedBuildParams / fromOmniaTxDraft', () => {
  it('normalizes EnhancedBuildParams with own-address change detection', () => {
    const tx = fromEnhancedBuildParams(
      {
        inputs: [{ address: 'MxWALLET', amount: '100', tokenId: '0x00' }],
        outputs: [
          { address: 'MxR', amount: '30', tokenId: '0x00' },
          { address: 'MxWALLET', amount: '70', tokenId: '0x00' },
        ],
      },
      ['MxWALLET'],
    );
    const effects = deriveEffectsFromBuiltTx(tx);
    expect(effects.spends).toHaveLength(1);
    expect(effects.spends[0].amount).toBe('30');
  });

  it('normalizes OmniaTxDraft with channel-internal exclusion', () => {
    const tx = fromOmniaTxDraft(
      {
        inputs: [{ address: '0xCH', amount: 1000n, tokenId: '0x00' }],
        outputs: [{ address: '0xCH', amount: 1000n, tokenId: '0x00' }],
      },
      '0xCH',
      [{ channelId: 'ch-1', operation: 'state_update' }],
    );
    const effects = deriveEffectsFromBuiltTx(tx);
    expect(effects.spends).toHaveLength(0);
    expect(effects.channels).toEqual([{ channelId: 'ch-1', operation: 'state_update' }]);
  });
});

describe('agent runtime with tx builder', () => {
  it('authorizes the REAL built tx spend, not the agent payload', async () => {
    const policy = await makePolicy();
    const ports = makePorts();
    const registry = createEdgeActionRegistry();
    // The wallet builds a tx that pays 40 to the recipient and 60 back as change.
    const txBuilder = {
      buildPaymentTx: jest.fn().mockResolvedValue({
        params: {
          inputs: [{ address: 'MxWALLET', amount: '100', tokenId: '0x00' }],
          outputs: [
            { address: 'MxRECIPIENT', amount: '40', tokenId: '0x00' },
            { address: 'MxWALLET', amount: '60', tokenId: '0x00' },
          ],
        },
        ownAddresses: ['MxWALLET'],
      }),
    };
    for (const { action, def } of createBuiltinActionDefinitions(ports, undefined, txBuilder)) {
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

    // Agent claims 100 — but the real tx only spends 40 (60 is change).
    const result = await runtime.executeAction({
      action: 'payment:send',
      subject: 'MxRECIPIENT',
      payload: { amount: '100', tokenId: '0x00' },
    });
    expect(result.ok).toBe(true);

    const graph = await policy.getRunReceiptGraph('run-1');
    const receipt = graph?.stepReceipts[0];
    // The committed effects reflect the REAL spend (40), not the agent's claim (100).
    expect(receipt?.effects?.spends).toEqual([{ tokenId: '0x00', amount: '40', recipient: 'MxRECIPIENT' }]);
  });

  it('rejects a spend that exceeds the ceiling once change is excluded', async () => {
    const policy = await makePolicy();
    const ports = makePorts();
    const registry = createEdgeActionRegistry();
    // Real tx spends 600 externally (no change) — exceeds maxGrossSpend 500.
    const txBuilder = {
      buildPaymentTx: jest.fn().mockResolvedValue({
        params: {
          inputs: [{ address: 'MxWALLET', amount: '600', tokenId: '0x00' }],
          outputs: [{ address: 'MxRECIPIENT', amount: '600', tokenId: '0x00' }],
        },
        ownAddresses: ['MxWALLET'],
      }),
    };
    for (const { action, def } of createBuiltinActionDefinitions(ports, undefined, txBuilder)) {
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
      payload: { amount: '600', tokenId: '0x00' },
    });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('REQUIRES_HUMAN');
    expect(ports.payment?.pay).not.toHaveBeenCalled();
  });
});
