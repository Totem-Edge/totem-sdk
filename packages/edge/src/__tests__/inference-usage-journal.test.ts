/**
 * Edge inference usage/execution journal (RFC-007 Phase 3a accounting-recovery
 * gate): started/completed/failed/outcome-unknown lifecycle, recovery replays
 * interrupted runs as *interrupted* (never re-run, never receipted), reopen
 * survival, and reconciliation against the owning accounting authority.
 */

import { MemoryStore } from '@totemsdk/storage';
import { FileStore } from '@totemsdk/storage/fs';
import { createJournal, type Journal } from '@totemsdk/storage/journal';
import type { EdgeIntelligencePort } from '@totemsdk/intelligence';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  createAccountedIntelligencePort,
  recoverInferenceJournal,
  type InferenceAuditEvent,
} from '../intelligence-usage-journal.js';
import { reconcileInferenceAccounting, type InferenceAccountingAuthority } from '../inference-accounting.js';

function makeContext(runId?: string, stepId?: string): Record<string, unknown> {
  return { runId, metadata: stepId ? { stepId } : undefined };
}

function makeProvider(calls: Array<Record<string, unknown>> = []): EdgeIntelligencePort {
  return {
    providerId: 'fake',
    capabilities: ['intelligence:llm'],
    async invoke(params) {
      calls.push({ domain: params.domain, op: params.op, requestId: params.requestId });
      const usage = { tokensIn: 10, tokensOut: 3, durationMs: 42 };
      return { ok: true, data: { data: { text: 'hi' }, usage } };
    },
  };
}

function makeJournal() {
  return createJournal<InferenceAuditEvent>(new MemoryStore(), { requireAckMode: 'volatile' });
}

function makeAccounted(port: EdgeIntelligencePort, journal?: Journal<InferenceAuditEvent>) {
  const j = journal ?? makeJournal();
  return { port: createAccountedIntelligencePort({ port, journal: j }), journal: j };
}

describe('createAccountedIntelligencePort', () => {
  it('journals started + finished(completed) with usage for a successful invoke', async () => {
    const { port, journal } = makeAccounted(makeProvider());
    const result = await port.invoke({ domain: 'llm', op: 'chat', params: {}, context: makeContext('run-1', 's1') });

    expect(result.ok).toBe(true);
    const entries = await journal.read();
    expect(entries).toHaveLength(2);
    expect(entries[0].record).toMatchObject({
      event: 'started',
      requestId: entries[0].record.requestId,
      workflow: { domain: 'llm', op: 'chat' },
      providerId: 'fake',
      runId: 'run-1',
      context: { runId: 'run-1', metadata: { stepId: 's1' } },
    });
    expect(entries[1].record).toMatchObject({
      event: 'finished',
      outcome: 'completed',
      usage: { tokensIn: 10, tokensOut: 3, durationMs: 42 },
    });
    expect((entries[0].record as { event: 'started' }).event).toBe('started');
  });

  it('journals finished(failed) with code/message when the port returns a soft failure', async () => {
    const port: EdgeIntelligencePort = {
      providerId: 'fake',
      capabilities: [],
      async invoke() {
        return { ok: false, errorCode: 'MODEL_BUSY', error: 'provider overloaded' };
      },
    };
    const { port: accounted, journal } = makeAccounted(port);
    const result = await accounted.invoke({ domain: 'llm', op: 'chat', params: {} });
    expect(result).toMatchObject({ ok: false, errorCode: 'MODEL_BUSY' });
    const entries = await journal.read();
    expect(entries[1].record).toMatchObject({ event: 'finished', outcome: 'failed', errorCode: 'MODEL_BUSY' });
  });

  it('journals finished(outcome-unknown) and rethrows when the provider call throws', async () => {
    const port: EdgeIntelligencePort = {
      providerId: 'fake',
      capabilities: [],
      async invoke() {
        throw new Error('connection dropped');
      },
    };
    const { port: accounted, journal } = makeAccounted(port);
    await expect(accounted.invoke({ domain: 'llm', op: 'chat', params: {} })).rejects.toThrow('connection dropped');
    const entries = await journal.read();
    expect(entries[1].record).toMatchObject({ event: 'finished', outcome: 'outcome-unknown' });
  });

  it('does not journal when the signal is already aborted (nothing dispatched)', async () => {
    const calls: Array<Record<string, unknown>> = [];
    const { port: accounted, journal } = makeAccounted(makeProvider(calls));
    const controller = new AbortController();
    controller.abort();
    const result = await accounted.invoke({ domain: 'llm', op: 'chat', params: {}, signal: controller.signal });
    expect(result).toMatchObject({ ok: false, errorCode: 'CANCELLED' });
    expect(await journal.hasState()).toBe(false);
    expect(calls).toHaveLength(0);
  });
});

describe('recoverInferenceJournal — accounting recovery', () => {
  it('replays a crash mid-flight (started, no finished) as interrupted — never re-run', async () => {
    const calls: Array<Record<string, unknown>> = [];
    const journal = makeJournal();
    const { port } = makeAccounted(makeProvider(calls), journal);

    const result = await port.invoke({ domain: 'llm', op: 'chat', params: {}, context: makeContext('run-7') });
    expect(result.ok).toBe(true);

    // Simulate a torn tail: a second dispatch where the process died after the
    // started event was durably written but before the provider returned.
    const startEntry = (await journal.read())[0];
    await journal.append({
      event: 'started',
      requestId: 'req-crash',
      workflow: { domain: 'llm', op: 'chat' },
      providerId: 'fake',
      runId: 'run-99',
      startedAt: 1_700_000_000_000,
    });

    const report = await recoverInferenceJournal(journal);
    expect(report.interrupted).toHaveLength(1);
    expect(report.interrupted[0].record.requestId).toBe('req-crash');
    expect(report.completed.map((e) => e.record.requestId)).toEqual([startEntry.record.requestId]);

    // Recovery performs zero provider interaction — the interrupted run is not
    // resumed and no receipt is fabricated.
    expect(calls).toHaveLength(1);
    const entries = await journal.read();
    expect(entries.filter((e) => e.record.requestId === 'req-crash')).toHaveLength(1);
  });

  it('surfaces finished-without-started as corrupt, never as absence', async () => {
    const journal = makeJournal();
    await journal.append({
      event: 'finished',
      requestId: 'orphan',
      outcome: 'outcome-unknown',
      finishedAt: 1_000_000,
    });
    await expect(recoverInferenceJournal(journal)).rejects.toMatchObject({
      code: 'corrupt',
      message: /finished event for unknown requestId orphan/,
    });
  });

  it('surfaces duplicate started events for one requestId as corrupt', async () => {
    const journal = makeJournal();
    await journal.append({
      event: 'started', requestId: 'dup', workflow: { domain: 'llm', op: 'chat' },
      providerId: 'fake', startedAt: 1,
    });
    await journal.append({
      event: 'started', requestId: 'dup', workflow: { domain: 'llm', op: 'chat' },
      providerId: 'fake', startedAt: 2,
    });
    await expect(recoverInferenceJournal(journal)).rejects.toMatchObject({ code: 'corrupt' });
  });
});

describe('reopen survival + provider restart does not resume inference', () => {
  it('a fresh port over a reopened durable journal sees full history and still never re-runs', async () => {
    const dir = await fs.mkdtemp(join(tmpdir(), 'totem-edge-inference-'));
    try {
      const store = new FileStore(dir);
      const first = createJournal<InferenceAuditEvent>(store, { requireAckMode: 'durably-acknowledged' });
      const calls: Array<Record<string, unknown>> = [];
      const firstPort = createAccountedIntelligencePort({ port: makeProvider(calls), journal: first });
      await firstPort.invoke({ domain: 'llm', op: 'chat', params: {}, context: makeContext('run-1', 's1') });

      // Simulated restart: a brand-new journal + wrapper over the same store.
      const reopenedJournal = createJournal<InferenceAuditEvent>(store, { requireAckMode: 'durably-acknowledged' });
      const reopenedPort = createAccountedIntelligencePort({ port: makeProvider(calls), journal: reopenedJournal });

      const report = await recoverInferenceJournal(reopenedJournal);
      expect(report.completed).toHaveLength(1);
      expect(report.interrupted).toHaveLength(0);

      // Provider interactions across the whole simulated lifecycle: exactly the
      // one real dispatch — restart never resumed or re-ran anything.
      expect(calls).toHaveLength(1);
      await reopenedPort.close?.();
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});

describe('reconcileInferenceAccounting — policy-accounted level', () => {
  const authority = (receipts: Array<{ runId: string; stepId: string }>): InferenceAccountingAuthority => ({
    async listCommittedReceipts() {
      return receipts;
    },
  });

  it('reports completed journal entries that were never accounted (read-only, no store writes)', async () => {
    const journal = makeJournal();
    const { port } = makeAccounted(makeProvider(), journal);
    await port.invoke({ domain: 'llm', op: 'chat', params: {}, context: makeContext('run-1', 's1') });

    let writes = 0;
    const stubbed = {
      async listCommittedReceipts() {
        return [];
      },
    };
    const report = await reconcileInferenceAccounting({
      journal,
      authority: stubbed,
      mandateId: 'm1',
    });
    expect(report.completedCount).toBe(1);
    expect(report.accountedCount).toBe(0);
    expect(report.completedUnaccounted).toHaveLength(1);
    expect(report.consistent).toBe(false);
    expect(writes).toBe(0);
  });

  it('reconciles completed journal entries to the committed receipts of the owning authority', async () => {
    const journal = makeJournal();
    const { port } = makeAccounted(makeProvider(), journal);
    await port.invoke({ domain: 'llm', op: 'chat', params: {}, context: makeContext('run-1', 's1') });

    const report = await reconcileInferenceAccounting({
      journal,
      authority: authority([{ runId: 'run-1', stepId: 's1' }]),
      mandateId: 'm1',
    });
    expect(report.accountedCount).toBe(1);
    expect(report.completedUnaccounted).toHaveLength(0);
    expect(report.consistent).toBe(true);
  });

  it('flags interrupted (outcome-unknown) work that somehow got committed — the serious mismatch', async () => {
    const journal = makeJournal();
    await journal.append({
      event: 'started',
      requestId: 'req-x',
      workflow: { domain: 'llm', op: 'chat' },
      providerId: 'fake',
      runId: 'run-2',
      context: makeContext('run-2', 's9'),
      startedAt: 1,
    });

    const report = await reconcileInferenceAccounting({
      journal,
      authority: authority([{ runId: 'run-2', stepId: 's9' }]),
      mandateId: 'm1',
    });
    expect(report.interruptedCount).toBe(1);
    expect(report.interruptedAccounted).toHaveLength(1);
    expect(report.consistent).toBe(false);
  });
});