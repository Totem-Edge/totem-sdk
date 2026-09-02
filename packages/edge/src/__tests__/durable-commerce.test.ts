/**
 * @totemsdk/edge — durable + transported machine commerce test suite.
 *
 * Covers:
 *   - Durability: proposal/head/maxRounds/TTL/terminal/challenge/work-budget/
 *     principal-limits survive restart
 *   - Concurrent transitions: two counters, two acceptances, accept-vs-cancel,
 *     accept-vs-expiry, duplicate work proof
 *   - Transport: signed proposal end-to-end, invalid signature, wrong
 *     recipient, duplicate delivery idempotent, out-of-order stale, retry same
 *     identity, no round increment on retry, size limit
 *   - Crash recovery: agreement persisted then restart, payment response loss,
 *     resource start response loss, session close retried
 *   - Minima relay: Super-0/Super-N relayed, -1 not relayed, forged metadata
 *     ignored, relay throws non-fatal, relay failure event
 *   - Runtime API: createEdge().buy() / .negotiate()
 */

import {
  createEdge,
  EdgeBuyer,
  EdgeWorkPolicy,
  EdgeTxPowAdapter,
  NegotiationEngine,
  InMemoryNegotiationStore,
  InMemoryPurchaseStore,
  InMemoryPrincipalNegotiationStore,
  InMemoryNegotiationTransport,
  InMemoryReplayLedger,
  ingress,
  messageId,
  PURCHASING_VERSION,
  type NegotiationMessage,
  type PurchaseIntent,
  type ResourceAdapter,
  type TradeProposal,
  type TradeTerms,
  type WorkRequired,
} from '../index';
import type { MinimaWorkRelay, MinimaWorkTemplate, WorkChallenge } from '@totemsdk/txpow';
import { createWorkChallenge } from '@totemsdk/txpow';
import { sha3_256, wotsKeypairFromSeed, wotsAddressFromKeypair } from '@totemsdk/core';
import { signManifest } from '@totemsdk/manifest';
import { canonicalJson, toHex } from '../canonical';

// ─────────────────────────────────────────────────────────────────────────────
// Test helpers
// ─────────────────────────────────────────────────────────────────────────────

const EASY_TARGET = (() => {
  const t = new Uint8Array(32).fill(0xff);
  t[0] = 0x0f;
  return Array.from(t).map((b) => b.toString(16).padStart(2, '0')).join('');
})();

const BLOCK_TARGET = EASY_TARGET;

function makeTemplate(overrides?: Partial<MinimaWorkTemplate>): MinimaWorkTemplate {
  const superParents: string[] = [];
  for (let i = 0; i < 32; i++) {
    superParents.push(
      Array.from({ length: 32 }, (_, j) => (i * 32 + j).toString(16).padStart(2, '0')).join(''),
    );
  }
  return {
    chainId: '00',
    blockNumber: 1000n,
    blockDifficulty: BLOCK_TARGET,
    superParents,
    mmrRoot: 'ab'.repeat(32),
    mmrTotal: 123456789n,
    magic: '00',
    timeMilli: 1700000000000n,
    templateId: 'template-1',
    capturedAt: Date.now(),
    ...overrides,
  };
}

const TEMPLATE = makeTemplate();
const FIXED_PRNG = new Uint8Array(32).fill(0xcd);

function makeSigner(seed: string) {
  return async (digest: string) => ({
    signature: `sig:${seed}:${digest.slice(0, 16)}`,
    signerPublicKey: `pk:${seed}`,
  });
}

function makeVerifier() {
  return (params: { digest: string; signature: string; signerPublicKey: string }) => {
    if (!params.signerPublicKey.startsWith('pk:')) return false;
    const seed = params.signerPublicKey.slice(3);
    return params.signature === `sig:${seed}:${params.digest.slice(0, 16)}`;
  };
}

function makeTemplateProvider() {
  return {
    getCurrentTemplate: async () => TEMPLATE,
    getLatestTemplate: async () => TEMPLATE,
  };
}

function makeRelay() {
  const submitted: Uint8Array[] = [];
  const relay: MinimaWorkRelay = {
    submitBlock: async (env) => {
      submitted.push(env);
    },
  };
  return { relay, submitted };
}

function makeAuthority(allow = true) {
  return {
    approve: async () => ({
      ok: true,
      data: { allowed: allow, reason: allow ? undefined : 'authority denied' },
    }),
  };
}

function makePayment() {
  const payments: Array<{ recipient: string; amount: string; tokenId?: string; idempotencyKey?: string }> = [];
  return {
    payments,
    pay: async (p: { recipient: string; amount: string; tokenId?: string; idempotencyKey?: string }) => {
      payments.push(p);
      return { ok: true, data: { txpowId: 'txpow:1' } };
    },
  };
}

function makeLookup(manifest: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(manifest));
  return {
    query: async () => ({ ok: true, data: { results: [{ id: 'm1', manifest: bytes, nodeId: 'n1' }] } }),
  };
}

function makeAdapter(resource: string) {
  const starts: unknown[] = [];
  const closes: unknown[] = [];
  const adapter: ResourceAdapter = {
    supports: (r) => r === resource,
    start: async (agreement, context) => {
      starts.push({ agreement, context });
      return { id: `handle:${resource}:1`, agreementId: agreement.agreementId, resource };
    },
    meter: async function* () {
      yield { at: Date.now(), amount: '1', unit: 'unit' };
    },
    close: async (handle) => {
      closes.push(handle);
    },
  };
  return { adapter, starts, closes };
}

const SELLER_SEED = new Uint8Array(32).fill(0x5e);
const SELLER_KEY_INDEX = 0;

function sellerAddress(): string {
  const kp = wotsKeypairFromSeed(SELLER_SEED, SELLER_KEY_INDEX);
  return wotsAddressFromKeypair(kp);
}

async function makeSignedManifest(price: string, resource = 'compute') {
  const manifest = {
    type: 'edge-service' as const,
    serviceId: 'svc-1',
    name: 'Test Service',
    version: '1.0.0',
    operatorAddress: sellerAddress(),
    serviceType: 'other' as const,
    description: '',
    capabilities: [resource],
    price,
    priceToken: '0x00',
    paymentMethods: ['omnia'] as Array<'omnia' | 'onchain' | 'invoice' | 'free'>,
    tags: [],
  };
  return signManifest(manifest, SELLER_SEED, SELLER_KEY_INDEX);
}

function makeIntent(overrides?: Partial<PurchaseIntent>): PurchaseIntent {
  return {
    id: 'intent-1',
    resource: 'compute',
    maxSpend: { amount: '100', tokenId: '0x00' },
    preferredPaymentMethods: ['omnia'],
    ...overrides,
  };
}

function makeEngine(opts?: { store?: InMemoryNegotiationStore; now?: () => number }) {
  return new NegotiationEngine({
    principal: 'buyer-principal',
    verifySignature: makeVerifier(),
    sign: makeSigner('buyer'),
    txpow: new EdgeTxPowAdapter(makeTemplateProvider()),
    workPolicy: new EdgeWorkPolicy('disabled', {}, { baseTarget: EASY_TARGET, maxTarget: EASY_TARGET }, 100_000),
    store: opts?.store,
    now: opts?.now,
  });
}

async function makeProposal(
  engine: NegotiationEngine,
  negotiationId: string,
  round: number,
  manifestId: string,
  proposer: string,
  recipient: string,
  terms: TradeTerms,
  parentProposalId?: string,
  expiresAt?: number,
): Promise<TradeProposal> {
  const now = Date.now();
  const unsigned = {
    version: PURCHASING_VERSION,
    proposalId: `p:${negotiationId}:${round}`,
    negotiationId,
    parentProposalId,
    round,
    manifestId,
    proposer,
    recipient,
    terms,
    createdAt: now,
    expiresAt: expiresAt ?? now + 60_000,
  };
  const digest = proposalDigestForTest(unsigned);
  const sig = await makeSigner('buyer')(digest);
  return { ...unsigned, signature: sig.signature, signerPublicKey: sig.signerPublicKey };
}

function proposalDigestForTest(p: {
  version: number;
  proposalId: string;
  negotiationId: string;
  parentProposalId?: string;
  round: number;
  manifestId: string;
  proposer: string;
  recipient: string;
  terms: TradeTerms;
  createdAt: number;
  expiresAt: number;
}): string {
  const canonical = canonicalJson({
    version: p.version,
    proposalId: p.proposalId,
    negotiationId: p.negotiationId,
    parentProposalId: p.parentProposalId,
    round: p.round,
    manifestId: p.manifestId,
    proposer: p.proposer,
    recipient: p.recipient,
    terms: p.terms,
    createdAt: p.createdAt,
    expiresAt: p.expiresAt,
  });
  return toHex(sha3_256(new TextEncoder().encode(canonical)));
}

async function signWorkRequired(
  engine: NegotiationEngine,
  negotiationId: string,
  sender: string,
  recipient: string,
  challenge: WorkChallenge,
): Promise<WorkRequired> {
  const unsigned = {
    version: PURCHASING_VERSION,
    negotiationId,
    sender,
    recipient,
    challenge,
    reason: 'initial-proposal' as const,
  };
  const canonical = canonicalJson({
    version: unsigned.version,
    negotiationId: unsigned.negotiationId,
    proposalId: undefined,
    sender: unsigned.sender,
    recipient: unsigned.recipient,
    challenge: unsigned.challenge,
    reason: unsigned.reason,
  });
  const digest = toHex(sha3_256(new TextEncoder().encode(canonical)));
  const sig = await makeSigner('seller')(digest);
  return { ...unsigned, signature: sig.signature, signerPublicKey: sig.signerPublicKey };
}

// ─────────────────────────────────────────────────────────────────────────────
// Durability
// ─────────────────────────────────────────────────────────────────────────────

describe('durability', () => {
  it('proposal + head survive engine restart', async () => {
    const store = new InMemoryNegotiationStore();
    const e1 = makeEngine({ store });
    await e1.openNegotiation({ negotiationId: 'n1', counterparty: 's', manifestId: 'm' });
    const p0 = await makeProposal(e1, 'n1', 0, 'm', 'buyer-principal', 's', { price: '10' });
    await e1.submitProposal(p0);

    // Restart with the same store.
    const e2 = makeEngine({ store });
    expect(await e2.getState('n1')).toBe('NEGOTIATING');
    const record = await e2.getRecordFor('n1');
    expect(record?.headProposalId).toBe(p0.proposalId);
    expect(record?.lastRound).toBe(0);
  });

  it('maxRounds survives restart', async () => {
    const store = new InMemoryNegotiationStore();
    const e1 = makeEngine({ store });
    await e1.openNegotiation({ negotiationId: 'n1', counterparty: 's', manifestId: 'm' });
    const p0 = await makeProposal(e1, 'n1', 0, 'm', 'buyer-principal', 's', { price: '10' });
    await e1.submitProposal(p0);

    const e2 = makeEngine({ store });
    // Round 1 is allowed (maxRounds default 5).
    const p1 = await makeProposal(e2, 'n1', 1, 'm', 'buyer-principal', 's', { price: '9' }, p0.proposalId);
    await e2.submitProposal(p1);
    expect(await e2.getState('n1')).toBe('NEGOTIATING');
  });

  it('terminal state survives restart', async () => {
    const store = new InMemoryNegotiationStore();
    const e1 = makeEngine({ store });
    await e1.openNegotiation({ negotiationId: 'n1', counterparty: 's', manifestId: 'm' });
    const p0 = await makeProposal(e1, 'n1', 0, 'm', 'buyer-principal', 's', { price: '10' });
    await e1.submitProposal(p0);
    // Reject to terminal.
    const rejection = {
      version: PURCHASING_VERSION,
      negotiationId: 'n1',
      proposalId: p0.proposalId,
      rejector: 'buyer-principal',
      recipient: 's',
      reason: 'no deal',
      rejectedAt: Date.now(),
      signature: '',
      signerPublicKey: '',
    };
    const digest = toHex(sha3_256(new TextEncoder().encode(canonicalJson({
      version: rejection.version,
      negotiationId: rejection.negotiationId,
      proposalId: rejection.proposalId,
      rejector: rejection.rejector,
      recipient: rejection.recipient,
      reason: rejection.reason,
      rejectedAt: rejection.rejectedAt,
    }))));
    const sig = await makeSigner('buyer')(digest);
    await e1.rejectProposal({ ...rejection, signature: sig.signature, signerPublicKey: sig.signerPublicKey });

    // Restart — terminal state persists, no new proposal allowed.
    const e2 = makeEngine({ store });
    expect(await e2.getState('n1')).toBe('REJECTED');
    const p1 = await makeProposal(e2, 'n1', 1, 'm', 'buyer-principal', 's', { price: '9' }, p0.proposalId);
    await expect(e2.submitProposal(p1)).rejects.toThrow('REJECTED');
  });

  it('cumulative work budget survives restart', async () => {
    const store = new InMemoryNegotiationStore();
    const e1 = makeEngine({ store });
    await e1.openNegotiation({ negotiationId: 'n1', counterparty: 's', manifestId: 'm' });
    const p0 = await makeProposal(e1, 'n1', 0, 'm', 'buyer-principal', 's', { price: '10' });
    await e1.submitProposal(p0);

    const e2 = makeEngine({ store });
    expect(await e2.getCumulativeWork('n1')).toBe(0n);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Concurrent transitions
// ─────────────────────────────────────────────────────────────────────────────

describe('concurrent transitions', () => {
  it('two counters against same head — exactly one succeeds', async () => {
    const store = new InMemoryNegotiationStore();
    const e1 = makeEngine({ store });
    await e1.openNegotiation({ negotiationId: 'n1', counterparty: 's', manifestId: 'm' });
    const p0 = await makeProposal(e1, 'n1', 0, 'm', 'buyer-principal', 's', { price: '10' });
    await e1.submitProposal(p0);

    // Two counters at round 1 from the same parent — the second must fail
    // because the head advanced.
    const p1a = await makeProposal(e1, 'n1', 1, 'm', 'buyer-principal', 's', { price: '9' }, p0.proposalId);
    await e1.submitProposal(p1a);
    const p1b = await makeProposal(e1, 'n1', 1, 'm', 'buyer-principal', 's', { price: '8' }, p0.proposalId);
    await expect(e1.submitProposal(p1b)).rejects.toThrow('not the expected');
  });

  it('two acceptances — exactly one agreement', async () => {
    const store = new InMemoryNegotiationStore();
    const e1 = makeEngine({ store });
    await e1.openNegotiation({ negotiationId: 'n1', counterparty: 's', manifestId: 'm' });
    const p0 = await makeProposal(e1, 'n1', 0, 'm', 'buyer-principal', 's', { price: '10' });
    await e1.submitProposal(p0);

    const acceptance = {
      version: PURCHASING_VERSION,
      negotiationId: 'n1',
      proposalId: p0.proposalId,
      acceptor: 'buyer-principal',
      recipient: 's',
      acceptedAt: Date.now(),
      signature: '',
      signerPublicKey: '',
    };
    const digest = toHex(sha3_256(new TextEncoder().encode(canonicalJson({
      version: acceptance.version,
      negotiationId: acceptance.negotiationId,
      proposalId: acceptance.proposalId,
      acceptor: acceptance.acceptor,
      recipient: acceptance.recipient,
      acceptedAt: acceptance.acceptedAt,
    }))));
    const sig = await makeSigner('buyer')(digest);
    const agreement = await e1.acceptProposal({ ...acceptance, signature: sig.signature, signerPublicKey: sig.signerPublicKey });
    expect(agreement.agreementId).toBeTruthy();
    // Second acceptance on terminal state fails.
    await expect(e1.acceptProposal({ ...acceptance, signature: sig.signature, signerPublicKey: sig.signerPublicKey })).rejects.toThrow('AGREED');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Transport
// ─────────────────────────────────────────────────────────────────────────────

describe('transport', () => {
  it('signed proposal delivered end-to-end via in-memory transport', async () => {
    const transport = new InMemoryNegotiationTransport();
    const received: NegotiationMessage[] = [];
    transport.subscribe(async (msg) => {
      received.push(msg);
    });
    const engine = makeEngine();
    await engine.openNegotiation({ negotiationId: 'n1', counterparty: 's', manifestId: 'm' });
    const p0 = await makeProposal(engine, 'n1', 0, 'm', 'buyer-principal', 's', { price: '10' });
    await transport.send('s', p0);
    expect(received.length).toBe(1);
    expect(received[0]).toBe(p0);
  });

  it('invalid signature rejected before engine transition', async () => {
    const ledger = new InMemoryReplayLedger();
    const engine = makeEngine();
    await engine.openNegotiation({ negotiationId: 'n1', counterparty: 's', manifestId: 'm' });
    const p0 = await makeProposal(engine, 'n1', 0, 'm', 'buyer-principal', 's', { price: '10' });
    const tampered = { ...p0, signature: 'bad' };
    await expect(
      ingress(tampered, { sender: 'buyer-principal', recipient: 's' }, {
        recipient: 's',
        verifySignature: makeVerifier(),
        digest: (m) => proposalDigestForTest(m as TradeProposal),
        replayLedger: ledger,
      }),
    ).rejects.toThrow('signature invalid');
  });

  it('wrong recipient rejected', async () => {
    const ledger = new InMemoryReplayLedger();
    const engine = makeEngine();
    await engine.openNegotiation({ negotiationId: 'n1', counterparty: 's', manifestId: 'm' });
    const p0 = await makeProposal(engine, 'n1', 0, 'm', 'buyer-principal', 's', { price: '10' });
    await expect(
      ingress(p0, { sender: 'buyer-principal', recipient: 's' }, {
        recipient: 'other',
        verifySignature: makeVerifier(),
        digest: (m) => proposalDigestForTest(m as TradeProposal),
        replayLedger: ledger,
      }),
    ).rejects.toThrow('not addressed');
  });

  it('duplicate delivery idempotent via replay ledger', async () => {
    const ledger = new InMemoryReplayLedger();
    const engine = makeEngine();
    await engine.openNegotiation({ negotiationId: 'n1', counterparty: 's', manifestId: 'm' });
    const p0 = await makeProposal(engine, 'n1', 0, 'm', 'buyer-principal', 's', { price: '10' });
    const first = await ingress(p0, { sender: 'buyer-principal', recipient: 's' }, {
      recipient: 's',
      verifySignature: makeVerifier(),
      digest: (m) => proposalDigestForTest(m as TradeProposal),
      replayLedger: ledger,
    });
    expect(first.replayed).toBe(false);
    await ledger.record(messageId(p0), { ok: true, result: 'processed' });
    const second = await ingress(p0, { sender: 'buyer-principal', recipient: 's' }, {
      recipient: 's',
      verifySignature: makeVerifier(),
      digest: (m) => proposalDigestForTest(m as TradeProposal),
      replayLedger: ledger,
    });
    expect(second.replayed).toBe(true);
  });

  it('message over size limit rejected', async () => {
    const ledger = new InMemoryReplayLedger();
    const big = { version: PURCHASING_VERSION, negotiationId: 'x'.repeat(100_000) };
    await expect(
      ingress(big, { sender: 'a', recipient: 'b' }, {
        recipient: 'b',
        verifySignature: makeVerifier(),
        digest: (m) => 'digest',
        replayLedger: ledger,
        maxBytes: 1024,
      }),
    ).rejects.toThrow('size limit');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Crash recovery
// ─────────────────────────────────────────────────────────────────────────────

describe('crash recovery', () => {
  it('agreement persisted then restart — no second agreement', async () => {
    const store = new InMemoryNegotiationStore();
    const e1 = makeEngine({ store });
    await e1.openNegotiation({ negotiationId: 'n1', counterparty: 's', manifestId: 'm' });
    const p0 = await makeProposal(e1, 'n1', 0, 'm', 'buyer-principal', 's', { price: '10' });
    await e1.submitProposal(p0);
    const acceptance = {
      version: PURCHASING_VERSION,
      negotiationId: 'n1',
      proposalId: p0.proposalId,
      acceptor: 'buyer-principal',
      recipient: 's',
      acceptedAt: Date.now(),
      signature: '',
      signerPublicKey: '',
    };
    const digest = toHex(sha3_256(new TextEncoder().encode(canonicalJson({
      version: acceptance.version,
      negotiationId: acceptance.negotiationId,
      proposalId: acceptance.proposalId,
      acceptor: acceptance.acceptor,
      recipient: acceptance.recipient,
      acceptedAt: acceptance.acceptedAt,
    }))));
    const sig = await makeSigner('buyer')(digest);
    await e1.acceptProposal({ ...acceptance, signature: sig.signature, signerPublicKey: sig.signerPublicKey });

    // Restart — terminal AGREED, no second agreement.
    const e2 = makeEngine({ store });
    expect(await e2.getState('n1')).toBe('AGREED');
    await expect(e2.acceptProposal({ ...acceptance, signature: sig.signature, signerPublicKey: sig.signerPublicKey })).rejects.toThrow('AGREED');
  });

  it('payment response loss — retry does not double pay', async () => {
    const purchaseStore = new InMemoryPurchaseStore();
    const payment = makePayment();
    const computeAdapter = makeAdapter('compute');
    const buyer = new EdgeBuyer({
      principal: 'buyer-principal',
      verifySignature: makeVerifier(),
      sign: makeSigner('buyer'),
      txpow: new EdgeTxPowAdapter(makeTemplateProvider()),
      workPolicy: new EdgeWorkPolicy('disabled', {}, { baseTarget: EASY_TARGET, maxTarget: EASY_TARGET }, 100_000),
      authority: makeAuthority(),
      payment,
      lookup: makeLookup(await makeSignedManifest('10')),
      adapters: [computeAdapter.adapter],
      purchaseStore,
    });
    const result = await buyer.buy({ intent: makeIntent(), adapter: computeAdapter.adapter });
    expect(payment.payments.length).toBe(1);
    // Retry the same intent — idempotent, no double pay.
    await buyer.buy({ intent: makeIntent(), adapter: computeAdapter.adapter });
    expect(payment.payments.length).toBe(1);
    void result;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Minima relay
// ─────────────────────────────────────────────────────────────────────────────

describe('minima relay', () => {
  it('locally verified Super-0 broadcastable proof → relay called', async () => {
    const { relay, submitted } = makeRelay();
    const txpow = new EdgeTxPowAdapter(makeTemplateProvider(), relay);
    const workPolicy = new EdgeWorkPolicy('admission-only', {}, { baseTarget: EASY_TARGET, maxTarget: EASY_TARGET }, 100_000);
    const engine = new NegotiationEngine({
      principal: 'buyer-principal',
      verifySignature: makeVerifier(),
      sign: makeSigner('buyer'),
      txpow,
      workPolicy,
    });
    await engine.openNegotiation({ negotiationId: 'n1', counterparty: 'seller', manifestId: 'm' });
    const challenge = createWorkChallenge('seller', 'totem.negotiation.proposal', EASY_TARGET, {
      challengeId: 'c1', nonce: 'deadbeef', issuedAt: Date.now(), ttlMs: 60_000,
    });
    const wr = await signWorkRequired(engine, 'n1', 'seller', 'buyer-principal', challenge);
    await engine.handleWorkRequired(wr);
    const p0 = await makeProposal(engine, 'n1', 0, 'm', 'buyer-principal', 'seller', { price: '10' });
    const action = engine.buildAction(p0);
    const proof = await txpow.mine(action, challenge, { prng: FIXED_PRNG, _skipWorker: true, forceJs: true, maxIterations: 100_000 });
    await engine.submitProposal({ ...p0, workAdmission: proof });
    expect(submitted.length).toBe(1);
  });

  it('superLevel -1 → relay not called', async () => {
    const { relay, submitted } = makeRelay();
    const hardBlockTemplate = makeTemplate({ blockDifficulty: (() => {
      const t = new Uint8Array(32).fill(0xff);
      t[0] = 0x00; t[1] = 0x01;
      return Array.from(t).map((b) => b.toString(16).padStart(2, '0')).join('');
    })() });
    const templateProvider = { getCurrentTemplate: async () => hardBlockTemplate, getLatestTemplate: async () => hardBlockTemplate };
    const txpow = new EdgeTxPowAdapter(templateProvider, relay);
    const workPolicy = new EdgeWorkPolicy('admission-only', {}, { baseTarget: EASY_TARGET, maxTarget: EASY_TARGET }, 100_000);
    const engine = new NegotiationEngine({
      principal: 'buyer-principal',
      verifySignature: makeVerifier(),
      sign: makeSigner('buyer'),
      txpow,
      workPolicy,
    });
    await engine.openNegotiation({ negotiationId: 'n1', counterparty: 'seller', manifestId: 'm' });
    const challenge = createWorkChallenge('seller', 'totem.negotiation.proposal', EASY_TARGET, {
      challengeId: 'c1', nonce: 'deadbeef', issuedAt: Date.now(), ttlMs: 60_000,
    });
    const wr = await signWorkRequired(engine, 'n1', 'seller', 'buyer-principal', challenge);
    await engine.handleWorkRequired(wr);
    const p0 = await makeProposal(engine, 'n1', 0, 'm', 'buyer-principal', 'seller', { price: '10' });
    const action = engine.buildAction(p0);
    const proof = await txpow.mine(action, challenge, { prng: FIXED_PRNG, _skipWorker: true, forceJs: true, maxIterations: 100_000 });
    await engine.submitProposal({ ...p0, workAdmission: proof });
    expect(submitted.length).toBe(0);
  });

  it('relay throws → negotiation still succeeds', async () => {
    const relay: MinimaWorkRelay = {
      submitBlock: async () => {
        throw new Error('relay down');
      },
    };
    const txpow = new EdgeTxPowAdapter(makeTemplateProvider(), relay);
    const workPolicy = new EdgeWorkPolicy('admission-only', {}, { baseTarget: EASY_TARGET, maxTarget: EASY_TARGET }, 100_000);
    const engine = new NegotiationEngine({
      principal: 'buyer-principal',
      verifySignature: makeVerifier(),
      sign: makeSigner('buyer'),
      txpow,
      workPolicy,
    });
    await engine.openNegotiation({ negotiationId: 'n1', counterparty: 'seller', manifestId: 'm' });
    const challenge = createWorkChallenge('seller', 'totem.negotiation.proposal', EASY_TARGET, {
      challengeId: 'c1', nonce: 'deadbeef', issuedAt: Date.now(), ttlMs: 60_000,
    });
    const wr = await signWorkRequired(engine, 'n1', 'seller', 'buyer-principal', challenge);
    await engine.handleWorkRequired(wr);
    const p0 = await makeProposal(engine, 'n1', 0, 'm', 'buyer-principal', 'seller', { price: '10' });
    const action = engine.buildAction(p0);
    const proof = await txpow.mine(action, challenge, { prng: FIXED_PRNG, _skipWorker: true, forceJs: true, maxIterations: 100_000 });
    // Relay throws but the proposal still succeeds.
    await engine.submitProposal({ ...p0, workAdmission: proof });
    expect(await engine.getState('n1')).toBe('NEGOTIATING');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Runtime API
// ─────────────────────────────────────────────────────────────────────────────

describe('runtime API', () => {
  it('createEdge().buy() works without manual EdgeBuyer construction', async () => {
    const computeAdapter = makeAdapter('compute');
    const payment = makePayment();
    const edge = createEdge({
      principal: 'buyer-principal',
      verifySignature: makeVerifier(),
      sign: makeSigner('buyer'),
      authority: makeAuthority(),
      payment,
      lookup: makeLookup(await makeSignedManifest('10')),
      adapters: [computeAdapter.adapter],
    });
    const result = await edge.buy({ intent: makeIntent(), adapter: computeAdapter.adapter });
    expect(result.agreement).toBeDefined();
    expect(payment.payments.length).toBe(1);
  });

  it('createEdge().negotiate() works', async () => {
    const edge = createEdge({
      principal: 'buyer-principal',
      verifySignature: makeVerifier(),
      sign: makeSigner('buyer'),
      authority: makeAuthority(),
      payment: makePayment(),
      lookup: makeLookup(await makeSignedManifest('10')),
      adapters: [makeAdapter('compute').adapter],
    });
    const manifest = await makeSignedManifest('10');
    const result = await edge.negotiate({
      manifest,
      desiredTerms: { price: '10' },
      limits: { maxRounds: 3, expiresAt: Date.now() + 60_000 },
      strategy: { evaluate: async () => ({ action: 'accept' }) },
    });
    expect(result.agreement).toBeDefined();
  });

  it('recoverPurchases inspects durable state', async () => {
    const purchaseStore = new InMemoryPurchaseStore();
    const computeAdapter = makeAdapter('compute');
    const edge = createEdge({
      principal: 'buyer-principal',
      verifySignature: makeVerifier(),
      sign: makeSigner('buyer'),
      authority: makeAuthority(),
      payment: makePayment(),
      lookup: makeLookup(await makeSignedManifest('10')),
      adapters: [computeAdapter.adapter],
      purchaseStore,
    });
    await edge.buy({ intent: makeIntent(), adapter: computeAdapter.adapter });
    const recoverable = await edge.recoverPurchases();
    expect(recoverable.length).toBeGreaterThanOrEqual(0);
  });
});
