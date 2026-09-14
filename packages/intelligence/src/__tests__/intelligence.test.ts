/**
 * Tests for @totemsdk/intelligence — contracts, literals, errors.
 */

import {
  INTELLIGENCE_DOMAINS,
  INTELLIGENCE_CAPABILITIES,
  INTELLIGENCE_OPS,
  INTELLIGENCE_VERSION,
  INTELLIGENCE_ERROR_MESSAGES,
  IntelligenceError,
} from '../index.js';

import type {
  IntelligenceDomain,
  IntelligenceCapability,
  IntelligenceProvider,
  IntelligenceOperation,
  IntelligenceOutcome,
  IntelligenceResult,
  IntelligenceErrorResult,
  IntelligenceStreamChunk,
  IntelligenceUsage,
  IntelligenceReceipt,
} from '../index.js';

describe('@totemsdk/intelligence', () => {
  describe('domain literals', () => {
    it('exposes the full domain catalog', () => {
      expect(INTELLIGENCE_DOMAINS).toEqual([
        'llm', 'embed', 'rag', 'asr', 'translate', 'tts',
        'diffusion', 'ocr', 'classify', 'audiogen', 'video',
        'vla', 'world', 'models', 'system', 'plugins',
      ]);
    });

    it('requires known domains to be assignable to the union type', () => {
      const leaf: IntelligenceDomain = 'llm';
      const rr: IntelligenceDomain = 'rag';
      expect(leaf).toBe('llm');
      expect(rr).toBe('rag');
    });

    it('rejects unknown domains at the type level (compile-time only)', () => {
      // @ts-expect-error — unknown domain is not assignable
      const bad: IntelligenceDomain = 'sentiment';
      void bad;
    });
  });

  describe('capability strings', () => {
    it('builds intelligence:domain capability literals', () => {
      expect(INTELLIGENCE_CAPABILITIES).toContain('intelligence:llm');
      expect(INTELLIGENCE_CAPABILITIES).toContain('intelligence:rag');
      expect(INTELLIGENCE_CAPABILITIES).toContain('intelligence:plugins');
      expect(INTELLIGENCE_CAPABILITIES).toHaveLength(INTELLIGENCE_DOMAINS.length);
    });

    it('typing: capability literal matches domain-action pattern', () => {
      const cap: IntelligenceCapability = 'intelligence:embed';
      expect(cap).toBe('intelligence:embed');
    });
  });

  describe('operation catalog', () => {
    it('maps every domain to at least one well-known op', () => {
      for (const domain of INTELLIGENCE_DOMAINS) {
        expect((INTELLIGENCE_OPS as Record<string, readonly string[]>)[domain].length).toBeGreaterThan(0);
      }
    });

    it('includes the core QVAC surface ops', () => {
      expect(INTELLIGENCE_OPS.llm).toContain('completion');
      expect(INTELLIGENCE_OPS.llm).toContain('batchCompletion');
      expect(INTELLIGENCE_OPS.asr).toContain('transcribe');
      expect(INTELLIGENCE_OPS.rag).toContain('ragSearch');
      expect(INTELLIGENCE_OPS.embed).toContain('embed');
      expect(INTELLIGENCE_OPS.tts).toContain('textToSpeech');
      expect(INTELLIGENCE_OPS.diffusion).toContain('diffusion');
      expect(INTELLIGENCE_OPS.models).toContain('loadModel');
    });
  });

  describe('version', () => {
    it('exposes a semver version', () => {
      expect(INTELLIGENCE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('IntelligenceError', () => {
    it('carries code + retryable flag', () => {
      const err = new IntelligenceError('NOT_FOUND', 'model not found');
      expect(err.code).toBe('NOT_FOUND');
      expect(err.retryable).toBe(false);
      expect(err.message).toBe('model not found');
    });

    it('defaults to a description when no message given', () => {
      const err = new IntelligenceError('TIMEOUT');
      expect(err.message).toBe(INTELLIGENCE_ERROR_MESSAGES.TIMEOUT);
    });

    it('marks transient codes retryable by default', () => {
      expect(new IntelligenceError('UNAVAILABLE').retryable).toBe(true);
      expect(new IntelligenceError('TIMEOUT').retryable).toBe(true);
      expect(new IntelligenceError('INTERNAL').retryable).toBe(false);
    });

    it('allows overriding retryable', () => {
      const err = new IntelligenceError('TIMEOUT', 'x', { retryable: false });
      expect(err.retryable).toBe(false);
    });

    it('is recognised by the type guard', () => {
      const err: unknown = new IntelligenceError('CANCELLED');
      expect(IntelligenceError.isIntelligenceError(err)).toBe(true);
      expect(IntelligenceError.isIntelligenceError(new Error('x'))).toBe(false);
    });

    it('covers every error code in the messages table', () => {
      const codes = [
        'NOT_IMPLEMENTED', 'NOT_LOADED', 'NOT_FOUND', 'UNAVAILABLE', 'TIMEOUT',
        'CANCELLED', 'INVALID_REQUEST', 'CONTEXT_OVERFLOW', 'POLICY_REJECTED',
        'BUDGET_EXCEEDED', 'INTERNAL',
      ] as const;
      for (const code of codes) {
        expect(INTELLIGENCE_ERROR_MESSAGES[code]).toBeTruthy();
        expect(new IntelligenceError(code).code).toBe(code);
      }
    });
  });

  describe('shape checks (compile-time contract verification)', () => {
    it('usage carries the metering fields policy needs', () => {
      const usage: IntelligenceUsage = {
        domain: 'llm',
        op: 'completion',
        model: 'llama',
        tokensIn: 10,
        tokensOut: 5,
        durationMs: 1200,
      };
      expect(usage.domain).toBe('llm');
      expect(usage.tokensIn!).toBeGreaterThan(0);
    });

    it('a provider result discriminates ok', () => {
      const ok: IntelligenceResult<string> = { ok: true, requestId: 'r1', data: 'hi' };
      const fail: IntelligenceErrorResult = { ok: false, requestId: 'r1', code: 'UNAVAILABLE', message: 'down', retryable: true };
      if (ok.ok) expect(ok.data).toBe('hi');
      if (!fail.ok) expect(fail.retryable).toBe(true);
    });

    it('stream chunks cover token/segment/progress/done vocabulary', () => {
      const chunks: IntelligenceStreamChunk[] = [
        { type: 'token', text: 'a' },
        { type: 'progress', percent: 50 },
        { type: 'done', usage: { domain: 'llm', op: 'completion', tokensIn: 1, tokensOut: 2, durationMs: 3 } },
      ];
      expect(chunks[0].type).toBe('token');
      expect(chunks[2].type).toBe('done');
    });

    it('receipt links to the governance layer', () => {
      const receipt: IntelligenceReceipt = {
        receiptId: 'rc1',
        provider: 'qvac',
        requestId: 'r1',
        proposalId: 'p1',
        runId: 'run1',
        domain: 'rag',
        op: 'ragSearch',
        usage: { tokensIn: 5, tokensOut: 0, durationMs: 400 },
        issuedAt: 1_700_000_000_000,
      };
      expect(receipt.proposalId).toBe('p1');
    });

    it('provider interface is structural (compile-time only)', () => {
      const provider: IntelligenceProvider = {
        id: 'test',
        displayName: 'Test',
        version: '1.0.0',
        capabilities: ['intelligence:llm'],
        isReady: true,
        invoke: async <T = unknown>(_op: IntelligenceOperation<T>) =>
          (await Promise.resolve()) as unknown as Promise<IntelligenceOutcome<T>>,
        invokeStream: async function* () {},
        cancel: async () => ({ ok: true, requestId: 'r', data: undefined }),
        close: async () => {},
      };
      expect(provider.capabilities[0]).toBe('intelligence:llm');
      const op: IntelligenceOperation = { domain: 'llm', op: 'completion', params: { prompt: 'x' } };
      expect(op.params.prompt).toBe('x');
    });
  });
});