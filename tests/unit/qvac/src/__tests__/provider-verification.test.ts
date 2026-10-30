/**
 * RFC-007 Phase 3a — QVAC provider-verification gate.
 *
 * Crash/disk behavior is exercised against the *injected runtime* and labelled
 * `provider-verified` — never an @totemsdk SDK guarantee. Includes the RFC
 * `provider-restart-does-not-resume-inference` assertion.
 */

import {
  QVAC_PROVIDER_VERIFIED_CLAIMS,
  verifyQvacRuntimeBehavior,
  type QvacRuntimeVerificationMark,
} from '../provider-verification.js';
import { createQvacIntelligenceProvider } from '../provider.js';
import type { QvacSdkLike } from '../qvac-sdk.js';

/** Minimal healthy runtime used as the base surface for the crash scenarios. */
function baseSdk(): QvacSdkLike {
  return {
    version: '0.19.0',
    completion: async () => ({ text: 'ok' }),
  };
}

describe('@totemsdk/qvac — provider-verification gate (Phase 3a)', () => {
  it('labels the boundary: provider-verified, not an SDK guarantee', () => {
    expect(QVAC_PROVIDER_VERIFIED_CLAIMS.provider).toBe('qvac');
    expect(QVAC_PROVIDER_VERIFIED_CLAIMS.level).toBe('provider-verified');
    expect(QVAC_PROVIDER_VERIFIED_CLAIMS.boundary).toContain('provider-verified');
    expect(QVAC_PROVIDER_VERIFIED_CLAIMS.boundary).toContain('not an @totemsdk SDK guarantee');
    expect(QVAC_PROVIDER_VERIFIED_CLAIMS.boundary).toContain('@totemsdk/storage');
  });

  it('verifies all three scenarios against the injected runtime and returns a provider-verified mark', async () => {
    const mark: QvacRuntimeVerificationMark = await verifyQvacRuntimeBehavior({ sdk: baseSdk() });
    expect(mark.level).toBe('provider-verified');
    expect(mark.provider).toBe('qvac');
    expect(mark.exercised).toEqual([
      'in-flight-runs-die-with-runtime',
      'restart-does-not-resume',
      'orphan-chunk-reindexing',
    ]);
    expect(mark.details).toHaveLength(3);
    for (const observation of mark.details) {
      expect(mark.exercised).toContain(observation.scenario);
      expect(observation.verifies.length).toBeGreaterThan(0);
    }
  });

  it('surfaces a violation instead of relabelling runtime behavior as an SDK guarantee', async () => {
    // A runtime whose ragSearch throws (index unavailable after crash) must
    // fail the gate — the runtime's degraded behavior is surfaced as a
    // violation, never labelled verified.
    const degraded = baseSdk();
    (degraded as Record<string, unknown>).ragSearch = async () => {
      throw new Error('index unavailable after crash');
    };
    await expect(verifyQvacRuntimeBehavior({ sdk: degraded })).rejects.toThrow(/ragSearch through the provider failed/);
  });

  describe('provider-restart-does-not-resume-inference', () => {
    it('a fresh provider instance over the same runtime never resumes an in-flight run', async () => {
      let completions = 0;
      let settle!: (value: unknown) => void;
      const sdk = baseSdk();
      (sdk as Record<string, unknown>).completion = () => {
        completions += 1;
        return new Promise((resolve) => {
          settle = resolve;
        });
      };

      const first = createQvacIntelligenceProvider({ sdk });
      const pending = first.invoke({
        domain: 'llm',
        op: 'completion',
        params: { prompt: 'x' },
        requestId: 'req-1',
      });
      await Promise.resolve();

      const second = createQvacIntelligenceProvider({ sdk });
      expect(second.activeRequests.size).toBe(0);
      expect((await second.cancel('req-1')).ok).toBe(false);

      settle({ text: 'done' });
      expect((await pending).ok).toBe(true);
      expect(completions).toBe(1);
    });

    it('a new dispatch through the restarted provider is a brand-new request', async () => {
      let completions = 0;
      const sdk = baseSdk();
      (sdk as Record<string, unknown>).completion = async () => {
        completions += 1;
        return { text: 'ok' };
      };

      const first = createQvacIntelligenceProvider({ sdk });
      await first.invoke({ domain: 'llm', op: 'completion', params: { prompt: 'a' } });

      const second = createQvacIntelligenceProvider({ sdk });
      const result = await second.invoke({
        domain: 'llm',
        op: 'completion',
        params: { prompt: 'b' },
        requestId: 'req-2',
      });
      expect(result.ok).toBe(true);
      expect(result.requestId).toBe('req-2');
      expect(completions).toBe(2);
    });
  });

  describe('in-flight runs die with the runtime; orphan repair is runtime-decided', () => {
    it('a completion interrupted by runtime death is a soft failure, never completed', async () => {
      const sdk = baseSdk();
      (sdk as Record<string, unknown>).completion = async () => {
        throw new Error('runtime process died');
      };
      const provider = createQvacIntelligenceProvider({ sdk });
      const result = await provider.invoke({
        domain: 'llm',
        op: 'completion',
        params: { prompt: 'x' },
        requestId: 'death',
      });
      expect(result.ok).toBe(false);
      expect(provider.activeRequests.size).toBe(0);
    });

    it('the adapter never triggers ragReindex implicitly after an interrupted reindex', async () => {
      const sdk = baseSdk();
      const called: string[] = [];
      (sdk as Record<string, unknown>).ragReindex = async () => {
        called.push('ragReindex');
        return { reindexed: true };
      };
      (sdk as Record<string, unknown>).ragSearch = async () => ({
        results: [{ chunkId: 'c-1', text: 'orphaned', orphanedAfterCrash: true }],
      });

      const provider = createQvacIntelligenceProvider({ sdk });
      const result = await provider.invoke({
        domain: 'rag',
        op: 'ragSearch',
        params: { query: 'q' },
      });
      expect(result.ok).toBe(true);
      expect(called).toEqual([]);
      expect(((result as { data: { results: unknown[] } }).data.results[0] as { chunkId: string }).chunkId).toBe('c-1');
    });
  });
});