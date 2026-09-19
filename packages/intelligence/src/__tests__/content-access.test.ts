/**
 * RFC-007 §5 / Phase 3a — content-level retrieval gating.
 *
 * Covers protected-retrieval isolation (isolated-workspace enforcement:
 * the provider never receives retrieval params for content the principal may
 * not read) and the revocation-without-cleanup gate (revoking one principal
 * never fires destructive ops and never touches other principals' content).
 */

import {
  createContentAccessGatedProvider,
  evaluateContentAccess,
  type ContentAccessPolicy,
} from '../content-access.js';
import type {
  IntelligenceContext,
  IntelligenceOperation,
  IntelligenceOutcome,
  IntelligenceProvider,
} from '../types.js';

interface RecordedCall {
  op: string;
  domain: string;
  params: Record<string, unknown>;
  context?: IntelligenceContext;
}

function recordingProvider() {
  const calls: RecordedCall[] = [];
  const provider: IntelligenceProvider = {
    id: 'mock',
    displayName: 'Mock QVAC',
    version: '0.19.0',
    capabilities: [],
    isReady: true,
    async invoke<T = unknown>(op: IntelligenceOperation<T>): Promise<IntelligenceOutcome<T>> {
      calls.push({ op: op.op, domain: op.domain, params: op.params, context: op.context });
      const ws = typeof op.params.workspaceId === 'string' ? op.params.workspaceId : 'ws-entitled';
      const data = op.op === 'ragSearch'
        ? [
            { doc: { workspaceId: ws, text: 'entitled hit' }, score: 0.9 },
            { doc: { workspaceId: 'ws-foreign', text: 'foreign hit' }, score: 0.2 },
            { doc: { text: 'bare hit' }, score: 0.1 },
          ]
        : { ok: true };
      return { ok: true, requestId: op.requestId ?? 'r-1', data: data as T };
    },
    async *invokeStream(): AsyncIterable<never> {
      /* not used */
      return;
    },
    async cancel() {
      return { ok: true, requestId: '', data: undefined };
    },
    async close() {},
  };
  return { provider, calls };
}

function op(
  domain: string,
  name: string,
  params: Record<string, unknown>,
  context: IntelligenceContext | undefined,
): IntelligenceOperation {
  return { domain, op: name, params, context };
}

const P1: IntelligenceContext = { principal: 'P1' };
const P2: IntelligenceContext = { principal: 'P2' };

function policy(entitlements: ContentAccessPolicy['entitlements'], overrides: Partial<ContentAccessPolicy> = {}): ContentAccessPolicy {
  return { entitlements, now: () => 5000, ...overrides };
}

describe('evaluateContentAccess — protected-retrieval isolation', () => {
  it('forces ragSearch to the single entitled workspace when none is given', () => {
    const d = evaluateContentAccess(
      policy([{ principal: 'P1', workspaceIds: ['ws-1'] }]),
      'rag', 'ragSearch', { text: 'q' }, P1,
    );
    expect(d.allowed).toBe(true);
    expect(d.workspaceId).toBe('ws-1');
    // The provider never receives retrieval params for un-entitled content.
    expect(d.params?.workspaceId).toBe('ws-1');
  });

  it('denies a cross-workspace search before the provider is reached', () => {
    const d = evaluateContentAccess(
      policy([{ principal: 'P1', workspaceIds: ['ws-1'] }]),
      'rag', 'ragSearch', { text: 'q', workspaceId: 'ws-2' }, P1,
    );
    expect(d.allowed).toBe(false);
    expect(d.reason).toContain("not entitled");
  });

  it('denies when there is no principal in context', () => {
    const d = evaluateContentAccess(
      policy([{ principal: 'P1', workspaceIds: ['ws-1'] }]),
      'rag', 'ragSearch', { text: 'q' }, undefined,
    );
    expect(d.allowed).toBe(false);
    expect(d.reason).toContain('principal');
  });

  it('denies a principal with no entitlement record', () => {
    const d = evaluateContentAccess(
      policy([{ principal: 'P1', workspaceIds: ['ws-1'] }]),
      'rag', 'ragSearch', { text: 'q' }, { principal: 'PHOSTILE' },
    );
    expect(d.allowed).toBe(false);
  });

  it('requires an explicit workspace when several are entitled', () => {
    const d = evaluateContentAccess(
      policy([{ principal: 'P1', workspaceIds: ['ws-1', 'ws-2'] }]),
      'rag', 'ragSearch', { text: 'q' }, P1,
    );
    expect(d.allowed).toBe(false);
    expect(d.reason).toContain('exactly one');
    const explicit = evaluateContentAccess(
      policy([{ principal: 'P1', workspaceIds: ['ws-1', 'ws-2'] }]),
      'rag', 'ragSearch', { text: 'q', workspaceId: 'ws-2' }, P1,
    );
    expect(explicit.allowed).toBe(true);
    expect(explicit.workspaceId).toBe('ws-2');
  });

  it('gates write/lifecycle ops to entitled workspaces', () => {
    const p = policy([{ principal: 'P1', workspaceIds: ['ws-1'] }]);
    for (const [name, params] of [
      ['ragIngest', { documents: [], embeddingModelId: 'm', workspaceId: 'ws-1' }],
      ['ragSaveEmbeddings', { chunks: [], embeddingModelId: 'm', workspaceId: 'ws-1' }],
      ['ragReindex', { workspaceId: 'ws-1' }],
      ['ragDeleteEmbeddings', { id: 'c-1', workspaceId: 'ws-1' }],
    ] as const) {
      expect(evaluateContentAccess(p, 'rag', name, params as Record<string, unknown>, P1).allowed).toBe(true);
      expect(evaluateContentAccess(p, 'rag', name, { ...(params as Record<string, unknown>), workspaceId: 'ws-2' }, P1).allowed).toBe(false);
    }
    // Destructive ops on un-entitled workspaces are refused.
    expect(evaluateContentAccess(p, 'rag', 'ragDeleteWorkspace', { workspaceId: 'ws-9' }, P1).allowed).toBe(false);
    expect(evaluateContentAccess(p, 'rag', 'ragDeleteWorkspace', { workspaceId: 'ws-1' }, P1).allowed).toBe(true);
    // Delete-workspace/close require the id outright.
    expect(evaluateContentAccess(p, 'rag', 'ragDeleteWorkspace', {}, P1).allowed).toBe(false);
    expect(evaluateContentAccess(p, 'rag', 'ragCloseWorkspace', { deleteOnClose: true }, P1).allowed).toBe(false);
  });

  it('fails closed once the entitlement snapshot is stale (offline policy)', () => {
    const stale = evaluateContentAccess(
      policy([{ principal: 'P1', workspaceIds: ['ws-1'] }], {
        observedAt: 0,
        freshnessMs: 1000,
        now: () => 2000,
      }),
      'rag', 'ragSearch', { text: 'q', workspaceId: 'ws-1' }, P1,
    );
    expect(stale.allowed).toBe(false);
    expect(stale.reason).toContain('stale');

    const fresh = evaluateContentAccess(
      policy([{ principal: 'P1', workspaceIds: ['ws-1'] }], {
        observedAt: 0,
        freshnessMs: 1000,
        now: () => 1000,
      }),
      'rag', 'ragSearch', { text: 'q', workspaceId: 'ws-1' }, P1,
    );
    expect(fresh.allowed).toBe(true);
  });

  it('does not gate non-rag operations', () => {
    const d = evaluateContentAccess(
      policy([{ principal: 'P1', workspaceIds: ['ws-1'] }]),
      'llm', 'completion', { prompt: 'hi' }, P1,
    );
    expect(d.allowed).toBe(true);
  });

  it('is enforced on the provider: rewrites, denies, and filters results', async () => {
    const { provider, calls } = recordingProvider();
    const gated = createContentAccessGatedProvider(
      policy([{ principal: 'P1', workspaceIds: ['ws-1'] }]),
      provider,
    );

    const search = await gated.invoke(op('rag', 'ragSearch', { text: 'q' }, P1));
    expect(search.ok).toBe(true);
    if (!search.ok) return;
    expect(calls[0].params.workspaceId).toBe('ws-1'); // isolated-workspace rewrite
    // Defense-in-depth: the foreign-workspace hit never reaches the caller.
    expect((search.data as Array<{ doc: { workspaceId?: string } }>).map((r) => r.doc.workspaceId))
      .toEqual(['ws-1', undefined]);

    const denied = await gated.invoke(op('rag', 'ragSearch', { text: 'q', workspaceId: 'ws-2' }, P1));
    expect(denied.ok).toBe(false);
    if (denied.ok) return;
    expect(denied.code).toBe('POLICY_REJECTED');
    expect(calls).toHaveLength(1); // provider never invoked for the denied search

    // Ungated ops still pass through.
    const completion = await gated.invoke(op('llm', 'completion', { prompt: 'hi' }, P1));
    expect(completion.ok).toBe(true);
    expect(calls).toHaveLength(2);
  });
});

describe('revocation-without-cleanup (RFC-007 §3.5)', () => {
  it('denies one principal without touching the workspace or other principals', async () => {
    const { provider, calls } = recordingProvider();
    // Both principals share ws-shared; each owns a private workspace.
    const entitlements = [
      { principal: 'P1', workspaceIds: ['ws-1', 'ws-shared'] },
      { principal: 'P2', workspaceIds: ['ws-2', 'ws-shared'] },
    ];

    const gated1 = createContentAccessGatedProvider(policy(entitlements), provider);
    expect((await gated1.invoke(op('rag', 'ragSearch', { text: 'q', workspaceId: 'ws-shared' }, P1))).ok).toBe(true);
    // ws-2 is P2's private workspace — P1 is denied even before any revocation.
    expect((await gated1.invoke(op('rag', 'ragSearch', { text: 'q', workspaceId: 'ws-2' }, P1))).ok).toBe(false);
    const callsBeforeRevocation = calls.length;

    // Revocation: P1 is denied ws-shared (and its private workspace revoked).
    const revoked = createContentAccessGatedProvider(
      policy([{ principal: 'P1', workspaceIds: [] }, { principal: 'P2', workspaceIds: ['ws-2', 'ws-shared'] }]),
      provider,
    );
    const deniedShared = await revoked.invoke(op('rag', 'ragSearch', { text: 'q', workspaceId: 'ws-shared' }, P1));
    expect(deniedShared.ok).toBe(false);
    const deniedPrivate = await revoked.invoke(op('rag', 'ragSearch', { text: 'q', workspaceId: 'ws-1' }, P1));
    expect(deniedPrivate.ok).toBe(false);

    // P2 — untouched — still reads ws-shared and its own workspace.
    const p2Shared = await revoked.invoke(op('rag', 'ragSearch', { text: 'q', workspaceId: 'ws-shared' }, P2));
    expect(p2Shared.ok).toBe(true);
    const p2Private = await revoked.invoke(op('rag', 'ragSearch', { text: 'q', workspaceId: 'ws-2' }, P2));
    expect(p2Private.ok).toBe(true);

    // NO destructive cleanup fired, for anyone — revocation never deleted or
    // reindexed content.
    const destructive = calls.filter((c) =>
      ['ragDeleteEmbeddings', 'ragDeleteWorkspace', 'ragCloseWorkspace', 'ragReindex', 'ragSaveEmbeddings'].includes(c.op),
    );
    expect(destructive).toEqual([]);
    // and none of the post-revocation P1 denials reached the provider.
    const postRevocationP1 = calls.slice(callsBeforeRevocation).filter((c) => c.context?.principal === 'P1');
    expect(postRevocationP1).toEqual([]);
  });
});