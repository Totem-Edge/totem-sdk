/**
 * RFC-007 Phase 3a accounting fold — commerce replay/outbox is the owning
 * domain accounting authority for purchase accounting.
 *
 * Covers the fold connector (completed purchase-bound inference dispatches
 * reconcile into the durable purchasing outbox as signed UsageStatements) and
 * the seller-side exactly-once reconciliation — with the hard rules that an
 * *interrupted* run is never billed and replayed statements never double-count.
 */

import { MemoryStore } from '@totemsdk/storage';
import { createJournal, type Journal } from '@totemsdk/storage/journal';
import type { EdgeIntelligencePort } from '@totemsdk/intelligence';
import type { MinimaWorkTemplate } from '@totemsdk/txpow';
import {
  createAccountedIntelligencePort,
  recoverInferenceJournal,
  type InferenceAuditEvent,
} from '../intelligence-usage-journal.js';
import {
  foldUsageStatements,
  foldCompletedDispatch,
  issueUsageStatement,
  usageStatementId,
  type UsageAgreementReference,
  type UsageAgreementResolver,
} from '../commerce-accounting.js';
import {
  createEdgeSeller,
  type EdgeSeller,
  EdgeTxPowAdapter,
  EdgeWorkPolicy,
  InMemoryNegotiationStore,
  InMemoryOutboxStore,
  InMemoryPrincipalNegotiationStore,
  InMemoryReplayLedger,
  InMemoryUsageStatementLogStore,
  messageId,
  messageType,
  type NegotiationMessage,
  type OutboxStore,
  type SellerServiceOptions,
  type UsageStatement,
  usageStatementDigest,
} from '../purchasing/index.js';

const AGREEMENT: UsageAgreementReference = {
  agreementId: 'ag-1',
  seller: 'seller-principal',
  negotiationId: 'neg-1',
  manifestId: 'manifest-1',
};

// ── signatures (mirrors durable-commerce.test.ts) ───────────────────────────
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

const EASY_TARGET = (() => {
  const t = new Uint8Array(32).fill(0xff);
  t[0] = 0x0f;
  return Array.from(t).map((b) => b.toString(16).padStart(2, '0')).join('');
})();

function makeTemplate(): MinimaWorkTemplate {
  const superParents: string[] = [];
  for (let i = 0; i < 32; i++) {
    superParents.push(Array.from({ length: 32 }, (_, j) => (i * 32 + j).toString(16).padStart(2, '0')).join(''));
  }
  return {
    chainId: '00',
    blockNumber: 1000n,
    blockDifficulty: EASY_TARGET,
    superParents,
    mmrRoot: 'ab'.repeat(32),
    mmrTotal: 123456789n,
    magic: '00',
    timeMilli: 1_700_000_000_000n,
    templateId: 'template-1',
    capturedAt: 1_700_000_000_000,
  };
}

function makeTemplateProvider() {
  return { getCurrentTemplate: async () => makeTemplate(), getLatestTemplate: async () => makeTemplate() };
}

function purchaseContext(agreement?: boolean): Record<string, unknown> {
  return agreement ? { runId: 'run-1', proposalId: 'proposal-1', agreementId: AGREEMENT.agreementId } : { runId: 'run-2' };
}

function makeProvider(calls: Array<Record<string, unknown>> = []): EdgeIntelligencePort {
  return {
    providerId: 'fake',
    capabilities: ['intelligence:llm'],
    async invoke(params) {
      calls.push({ domain: params.domain, op: params.op, requestId: params.requestId });
      return { ok: true, data: { data: { text: 'hi' }, usage: { tokensIn: 10, tokensOut: 3, durationMs: 42 } } };
    },
  };
}

function makeJournal() {
  return createJournal<InferenceAuditEvent>(new MemoryStore(), { requireAckMode: 'volatile' });
}

function resolveAgreement(): UsageAgreementResolver {
  return (input) => (isPurchaseBound(input.context) ? AGREEMENT : undefined);
}

function isPurchaseBound(context: Record<string, unknown> | undefined): boolean {
  if (!context) return false;
  return context.agreementId !== undefined || context.proposalId !== undefined;
}

function makeOutbox() {
  const outbox: OutboxStore = new InMemoryOutboxStore();
  return outbox;
}

function foldInput(overrides?: { journal?: Journal<InferenceAuditEvent> }) {
  const journal = overrides?.journal ?? makeJournal();
  return {
    journal,
    outbox: makeOutbox(),
    signer: makeSigner('buyer'),
    principal: 'buyer-principal',
    resolveAgreement: resolveAgreement(),
    now: () => 1_700_000_000_000,
  };
}

async function statementsIn(outbox: OutboxStore): Promise<UsageStatement[]> {
  return (await outbox.listUndelivered()).map((e) => e.message as UsageStatement);
}

describe('UsageStatement wire message', () => {
  it('is classified and given a deterministic messageId', async () => {
    const statement = await issueUsageStatement({
      principal: 'buyer-principal',
      agreement: AGREEMENT,
      requestId: 'req-1',
      usage: { tokensIn: 10, tokensOut: 3, durationMs: 42 },
      signer: makeSigner('buyer'),
      now: () => 1_700_000_000_000,
    });
    expect(statement.statementId).toBe('ag-1:req-1:usage');
    expect(usageStatementId(AGREEMENT.agreementId, 'req-1')).toBe(statement.statementId);
    expect(messageType(statement)).toBe('UsageStatement');
    expect(await verifyStatement(statement)).toBe(true);
    // Deterministic: regenerating the same statement yields the same messageId.
    const again = await issueUsageStatement({
      principal: 'buyer-principal',
      agreement: AGREEMENT,
      requestId: 'req-1',
      usage: { tokensIn: 10, tokensOut: 3, durationMs: 42 },
      signer: makeSigner('buyer'),
      now: () => 1_700_000_000_000,
    });
    expect(messageId(again)).toBe(messageId(statement));
  });
});

async function verifyStatement(statement: UsageStatement): Promise<boolean> {
  const digest = usageStatementDigest(statement);
  return makeVerifier()({
    digest,
    signature: statement.signature,
    signerPublicKey: statement.signerPublicKey,
  });
}

describe('foldUsageStatements — reconciliation to the commerce authority', () => {
  it('folds a completed purchase-bound dispatch into the outbox as a signed statement', async () => {
    const { journal, port } = makeAccountedOutbox();
    await port.invoke({ domain: 'llm', op: 'chat', params: {}, context: purchaseContext(true), requestId: 'req-1' });

    const input = foldInput({ journal });
    const report = await foldUsageStatements(input);
    expect(report.folded).toBe(1);
    expect(report.interrupted).toBe(0);
    expect(report.dropped).toBe(0);
    expect(report.skippedNotPurchaseBound).toBe(0);

    const [statement] = await statementsIn(input.outbox);
    expect(statement.requestId).toBe('req-1');
    expect(statement.agreementId).toBe('ag-1');
    expect(statement.recipient).toBe('seller-principal');
    expect(statement.issuer).toBe('buyer-principal');
    expect(statement.usage).toMatchObject({ tokensIn: 10, tokensOut: 3, durationMs: 42 });
    expect(await verifyStatement(statement)).toBe(true);
  });

  it('NEVER folds an interrupted run (started, no finished) — nothing is billed', async () => {
    const journal = makeJournal();
    await journal.append({
      event: 'started',
      requestId: 'req-crash',
      workflow: { domain: 'llm', op: 'chat' },
      providerId: 'fake',
      context: purchaseContext(true),
      startedAt: 1_700_000_000_000,
    });

    const input = foldInput({ journal });
    const report = await foldUsageStatements(input);
    expect(report.interrupted).toBe(1);
    expect(report.folded).toBe(0);
    expect(await input.outbox.listUndelivered()).toHaveLength(0);
  });

  it('never folds failed or outcome-unknown runs', async () => {
    const journal = makeJournal();
    await journal.append({
      event: 'started', requestId: 'req-failed', workflow: { domain: 'llm', op: 'chat' }, providerId: 'fake',
      context: purchaseContext(true), startedAt: 1_700_000_000_000,
    });
    await journal.append({
      event: 'finished', requestId: 'req-failed', outcome: 'failed', context: purchaseContext(true), finishedAt: 1_700_000_000_100,
    });
    await journal.append({
      event: 'started', requestId: 'req-unknown', workflow: { domain: 'llm', op: 'chat' }, providerId: 'fake',
      context: purchaseContext(true), startedAt: 1_700_000_000_000,
    });
    await journal.append({
      event: 'finished', requestId: 'req-unknown', outcome: 'outcome-unknown', context: purchaseContext(true), finishedAt: 1_700_000_000_100,
    });

    const input = foldInput({ journal });
    const report = await foldUsageStatements(input);
    expect(report.folded).toBe(0);
    expect(report.interrupted).toBe(0);
    expect(await input.outbox.listUndelivered()).toHaveLength(0);
  });

  it('skips completed dispatches that are not purchase-bound', async () => {
    const journal = makeJournal();
    await journal.append({
      event: 'started', requestId: 'req-noun', workflow: { domain: 'llm', op: 'chat' }, providerId: 'fake',
      context: { runId: 'plain' }, startedAt: 1_700_000_000_000,
    });
    await journal.append({
      event: 'finished', requestId: 'req-noun', outcome: 'completed', context: { runId: 'plain' }, finishedAt: 1_700_000_000_100,
    });

    const input = foldInput({ journal });
    const report = await foldUsageStatements(input);
    expect(report.skippedNotPurchaseBound).toBe(1);
    expect(report.folded).toBe(0);
    expect(await input.outbox.listUndelivered()).toHaveLength(0);
  });

  it('drops a purchase-bound dispatch whose agreement cannot be resolved', async () => {
    const journal = makeJournal();
    await journal.append({
      event: 'started', requestId: 'req-dropped', workflow: { domain: 'llm', op: 'chat' }, providerId: 'fake',
      context: purchaseContext(true), startedAt: 1_700_000_000_000,
    });
    await journal.append({
      event: 'finished', requestId: 'req-dropped', outcome: 'completed', context: purchaseContext(true), finishedAt: 1_700_000_000_100,
    });

    const input = { ...foldInput({ journal }), resolveAgreement: () => undefined };
    const report = await foldUsageStatements(input);
    expect(report.dropped).toBe(1);
    expect(await input.outbox.listUndelivered()).toHaveLength(0);
  });

  it('is idempotent — a re-fold re-enqueues the SAME messageId, never a duplicate', async () => {
    const { journal, port } = makeAccountedOutbox();
    await port.invoke({ domain: 'llm', op: 'chat', params: {}, context: purchaseContext(true), requestId: 'req-1' });

    const input = foldInput({ journal });
    const first = await foldUsageStatements(input);
    const second = await foldUsageStatements(input);
    expect(first.folded).toBe(1);
    expect(second.folded).toBe(1); // completed re-fold is a no-op on the store
    const statements = await input.outbox.listUndelivered();
    expect(statements).toHaveLength(1); // same statementId, one durable entry
  });
});

function makeAccountedOutbox() {
  const journal = makeJournal();
  return { journal, port: createAccountedIntelligencePort({ port: makeProvider(), journal }) };
}

describe('live fold via the accounted port afterCompleted hook', () => {
  it('folds a live completed purchase-bound dispatch without re-running after restart', async () => {
    const journal = makeJournal();
    const calls: Array<Record<string, unknown>> = [];
    const outbox = makeOutbox();
    const port = createAccountedIntelligencePort({
      port: makeProvider(calls),
      journal,
      afterCompleted: async (completed) => {
        await foldCompletedDispatch({
          outbox,
          signer: makeSigner('buyer'),
          principal: 'buyer-principal',
          requestId: completed.requestId,
          context: completed.context,
          usage: completed.usage,
          resolveAgreement: resolveAgreement(),
          now: () => 1_700_000_000_000,
        });
      },
    });

    await port.invoke({ domain: 'llm', op: 'chat', params: {}, context: purchaseContext(true), requestId: 'req-live' });
    const [statement] = await statementsIn(outbox);
    expect(statement?.requestId).toBe('req-live');

    // Restart: recovery re-folds the same statement idempotently (SAME id).
    const report = await recoverInferenceJournal(journal);
    expect(report.completed.map((e) => e.record.requestId)).toContain('req-live');
    expect(calls).toHaveLength(1); // never re-run
    const input = foldInput({ journal });
    const foldedAgain = await foldUsageStatements(input);
    expect(foldedAgain.folded).toBe(1);
    const all = await input.outbox.listUndelivered();
    expect(all).toHaveLength(1);
    expect(all[0].messageId).toBe((await outbox.listUndelivered())[0].messageId);
  });

  it('does NOT fold an outcome-unknown (thrown) dispatch or a non-purchase-bound one', async () => {
    const journal = makeJournal();
    const calls: Array<Record<string, unknown>> = [];
    const flakyPort: EdgeIntelligencePort = {
      providerId: 'fake',
      capabilities: ['intelligence:llm'],
      async invoke(params) {
        calls.push(params);
        if ((params.context as Record<string, unknown> | undefined)?.runId === 'boom') {
          throw new Error('dropped');
        }
        return { ok: true, data: { data: { text: 'hi' }, usage: { tokensIn: 10, tokensOut: 3, durationMs: 42 } } };
      },
    };
    const outbox = makeOutbox();
    const port = createAccountedIntelligencePort({
      port: flakyPort,
      journal,
      afterCompleted: async (completed) => {
        await foldCompletedDispatch({
          outbox,
          signer: makeSigner('buyer'),
          principal: 'buyer-principal',
          requestId: completed.requestId,
          context: completed.context,
          usage: completed.usage,
          resolveAgreement: resolveAgreement(),
        });
      },
    });

    await expect(
      port.invoke({ domain: 'llm', op: 'chat', params: {}, context: { ...purchaseContext(true), runId: 'boom' } }),
    ).rejects.toThrow('dropped');
    await port.invoke({ domain: 'llm', op: 'chat', params: {}, context: purchaseContext(false), requestId: 'req-plain' });

    expect(await outbox.listUndelivered()).toHaveLength(0);
  });
});

describe('seller-side reconciliation — exactly-once per statement', () => {
  function makeSeller(opts?: { withoutLog?: boolean; verifyAgreement?: (params: { agreementId: string; buyer: string; requestId: string }) => boolean }): {
    seller: EdgeSeller;
    log: InMemoryUsageStatementLogStore;
  } {
    const log = new InMemoryUsageStatementLogStore();
    const options: SellerServiceOptions = {
      principal: 'seller-principal',
      verifySignature: makeVerifier(),
      sign: makeSigner('seller'),
      txpow: new EdgeTxPowAdapter(makeTemplateProvider()),
      workPolicy: new EdgeWorkPolicy('disabled', {}, { baseTarget: EASY_TARGET, maxTarget: EASY_TARGET }, 100_000),
      negotiationStore: new InMemoryNegotiationStore(),
      principalStore: new InMemoryPrincipalNegotiationStore(),
      outboxStore: new InMemoryOutboxStore(),
      replayLedger: new InMemoryReplayLedger(),
      strategy: { evaluate: async () => ({ action: 'reject' }) },
      usageStatementLog: opts?.withoutLog ? undefined : log,
      verifyUsageStatementAgreement: opts?.verifyAgreement,
    };
    return { seller: createEdgeSeller(options), log };
  }

  async function deliver(seller: EdgeSeller, statement: UsageStatement) {
    return seller.handleInbound(statement as NegotiationMessage, {
      sender: 'buyer-principal',
      recipient: 'seller-principal',
    });
  }

  it('reconciles an inbound statement exactly once (replay dedupes)', async () => {
    const { seller, log } = makeSeller({ verifyAgreement: () => true });
    const statement = await issueUsageStatement({
      principal: 'buyer-principal',
      agreement: AGREEMENT,
      requestId: 'req-1',
      usage: { tokensIn: 10 },
      signer: makeSigner('buyer'),
    });

    const first = await deliver(seller, statement);
    expect(first.ok).toBe(true);
    const replayed = await deliver(seller, statement);
    expect(replayed.ok).toBe(true);

    expect(await log.list()).toHaveLength(1);
    expect(await log.has('ag-1:req-1:usage')).toBe(true);
  });

  it('refuses to reconcile when the seller has no statement log (no silent accounting)', async () => {
    const { seller } = makeSeller({ withoutLog: true });
    const statement = await issueUsageStatement({
      principal: 'buyer-principal', agreement: AGREEMENT, requestId: 'req-1', signer: makeSigner('buyer'),
    });
    const outcome = await deliver(seller, statement);
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toContain('not configured');
  });

  it('rejects a statement whose agreement was never negotiated', async () => {
    const { seller, log } = makeSeller({ verifyAgreement: () => false });
    const statement = await issueUsageStatement({
      principal: 'buyer-principal', agreement: AGREEMENT, requestId: 'req-1', signer: makeSigner('buyer'),
    });
    const outcome = await deliver(seller, statement);
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toContain('does not match a negotiated agreement');
    expect(await log.list()).toHaveLength(0);
  });

  it('rejects a statement with an invalid signature (ingress)', async () => {
    const { seller, log } = makeSeller({ verifyAgreement: () => true });
    const statement = await issueUsageStatement({
      principal: 'buyer-principal', agreement: AGREEMENT, requestId: 'req-2', signer: makeSigner('buyer'),
    });
    const forged = { ...statement, signature: 'sig:attacker:bogus' };
    const outcome = await deliver(seller, forged);
    expect(outcome.ok).toBe(false);
    expect(outcome.error).toContain('signature');
    expect(await log.list()).toHaveLength(0);
  });

  it('rejects a statement addressed to another recipient (ingress)', async () => {
    const { seller, log } = makeSeller({ verifyAgreement: () => true });
    const statement = await issueUsageStatement({
      principal: 'buyer-principal', agreement: AGREEMENT, requestId: 'req-3', signer: makeSigner('buyer'),
    });
    const misaddressed = { ...statement, recipient: 'some-other-principal' };
    const outcome = await deliver(seller, misaddressed);
    expect(outcome.ok).toBe(false);
    expect(await log.list()).toHaveLength(0);
  });
});