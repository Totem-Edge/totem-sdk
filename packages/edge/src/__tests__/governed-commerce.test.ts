/**
 * RFC-019 P0: governed commerce — agents reach purchasing only through
 * `createAgentEdgeRuntime().executeAction`, never a raw buyer/payment port.
 */
import { createEdgeActionRegistry } from '../action-registry.js';
import { createAgentEdgeRuntime } from '../agent-runtime.js';
import { createGovernedPurchaseActions } from '../governed-commerce.js';
import { createCapabilitySet } from '../capabilities.js';
import {
  GrantBoundAutonomyPolicy,
  MemoryRunStateStore,
  type AutonomyProfile,
} from '@totemsdk/agent-policy';
import type { AuthorityIdentityResolver } from '@totemsdk/authority';
import { createAgentMandate } from '@totemsdk/authority';
import type { SignedProof } from '@totemsdk/proof';
import { createProof, signProof } from '@totemsdk/proof';
import { createIdentityDocument, createDelegationClaim, signIdentityClaim } from '@totemsdk/identity';
import { wotsKeypairFromSeed, scriptFromWotsPk, scriptToAddress } from '@totemsdk/core';
import type { EdgeBuyer, PreparedPurchase } from '../purchasing/buyer.js';
import type { TradeAgreement, PurchaseIntent } from '../purchasing/types.js';

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

async function makePolicy(maxGrossSpend: string) {
  const { resolver, identityId } = await makeResolver();
  PRINCIPAL_ID = identityId;
  const mandate = makeMandateProof(identityId, '*');
  const profile: AutonomyProfile = {
    profileId: 'edge-agent',
    mode: 'dynamic',
    runLimits: {
      maxSteps: 20,
      maxParallel: 1,
      maxFailures: 3,
      maxDurationMs: 3_600_000,
      maxGrossSpend: { tokenId: '0x00', amount: maxGrossSpend },
      maxFees: { tokenId: '0x00', amount: '10' },
    },
    boundaryFailure: 'request_narrow_grant',
  };
  const policy = new GrantBoundAutonomyPolicy({
    autonomyProfiles: { 'edge-agent': profile },
    mandateResolver: async (id) => (id === 'totem:mandate:owner' ? mandate : undefined),
    identityResolver: resolver,
    stateStore: new MemoryRunStateStore({ now: () => 1000 }),
    now: () => 1000,
  });
  await policy.openRun({ runId: 'run-1', agentId: ADDR_AGENT, principal: PRINCIPAL_ID, grantProofIds: ['totem:mandate:owner'], profileId: 'edge-agent' });
  return policy;
}

const intent: PurchaseIntent = {
  id: 'i1',
  resource: 'gpu',
  maxSpend: { amount: '500', tokenId: '0x00' },
  expiresAt: 10_000,
};

function agreementAt(price: string): TradeAgreement {
  return {
    version: 1,
    agreementId: `a-${price}`,
    negotiationId: 'n1',
    acceptedProposalId: 'x',
    manifestId: 'm1',
    buyer: PRINCIPAL_ID,
    seller: 'SELLER_ADDR',
    terms: { price, tokenId: '0x00', paymentMethod: 'onchain' },
    agreedAt: 0,
    expiresAt: 10_000,
    buyerSignature: '',
    sellerSignature: '',
  };
}

function makeStubBuyer(agreement: TradeAgreement) {
  const prepared = { purchaseId: 'p1', intent, agreement, options: {}, record: {} } as unknown as PreparedPurchase;
  const prepareBuy = jest.fn().mockResolvedValue(prepared);
  const executePrepared = jest.fn().mockResolvedValue({ agreement, session: { id: 'r1' }, negotiated: true });
  const negotiate = jest.fn();
  return { buyer: { prepareBuy, executePrepared, negotiate } as unknown as EdgeBuyer, prepareBuy, executePrepared };
}

function makeRuntime(policy: GrantBoundAutonomyPolicy, buyer: EdgeBuyer) {
  const registry = createEdgeActionRegistry();
  for (const reg of createGovernedPurchaseActions({ buyer })) registry.register(reg.def, reg.action);
  const capabilities = createCapabilitySet(['purchase:buy', 'purchase:negotiate']);
  return createAgentEdgeRuntime({
    deviceId: 'dev-1',
    capabilities,
    registry,
    policy,
    runId: 'run-1',
    principal: PRINCIPAL_ID,
    agentId: ADDR_AGENT,
    now: () => 1000,
  });
}

describe('RFC-019 P0: governed purchase:buy', () => {
  it('authorizes canonical effects from the prepared agreement and executes once', async () => {
    const policy = await makePolicy('500');
    const { buyer, executePrepared } = makeStubBuyer(agreementAt('100'));
    const authorizeSpy = jest.spyOn(policy, 'authorizeAndReserve');
    const runtime = makeRuntime(policy, buyer);

    // Agent claims a different recipient/amount — must be ignored.
    const result = await runtime.executeAction({
      action: 'purchase:buy',
      subject: 'SELLER_ADDR',
      payload: { intent, amount: '0', recipient: 'ATTACKER' },
    });

    expect(result.ok).toBe(true);
    expect(executePrepared).toHaveBeenCalledTimes(1);
    expect(executePrepared).toHaveBeenCalledWith(expect.anything(), { skipAuthority: true });

    const canonical = authorizeSpy.mock.calls[0][0].action;
    expect(canonical.effects.spends).toEqual([
      { tokenId: '0x00', amount: '100', recipient: 'SELLER_ADDR' },
    ]);
  });

  it('rejects a purchase whose canonical spend exceeds the run budget', async () => {
    const policy = await makePolicy('500');
    const { buyer, executePrepared } = makeStubBuyer(agreementAt('600'));
    const runtime = makeRuntime(policy, buyer);

    const result = await runtime.executeAction({ action: 'purchase:buy', subject: 'SELLER_ADDR', payload: { intent } });

    expect(result.ok).toBe(false);
    expect(['REQUIRES_HUMAN', 'POLICY_REJECTED']).toContain(result.errorCode);
    expect(executePrepared).not.toHaveBeenCalled();
  });

  it('never exposes a raw buyer or ports to the agent', async () => {
    const policy = await makePolicy('500');
    const { buyer } = makeStubBuyer(agreementAt('100'));
    const runtime = makeRuntime(policy, buyer) as unknown as Record<string, unknown>;
    expect(runtime.buyer).toBeUndefined();
    expect(runtime.ports).toBeUndefined();
    expect(Object.keys(runtime).sort()).toEqual(['deviceId', 'executeAction', 'version']);
  });

  it('fails closed when the governed action is not registered', async () => {
    const policy = await makePolicy('500');
    const { buyer } = makeStubBuyer(agreementAt('100'));
    const registry = createEdgeActionRegistry(); // no governed actions
    const runtime = createAgentEdgeRuntime({
      deviceId: 'dev-1',
      capabilities: createCapabilitySet(['purchase:buy']),
      registry,
      policy,
      runId: 'run-1',
      principal: PRINCIPAL_ID,
      agentId: ADDR_AGENT,
      now: () => 1000,
    });
    const result = await runtime.executeAction({ action: 'purchase:buy', subject: 'x', payload: { intent } });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('UNKNOWN_ACTION');
  });
});
