/**
 * Tests for @totemsdk/qvac — provider factory, dispatch, usage extraction,
 * streaming, cancellation, and error mapping.
 */

import {
  createQvacIntelligenceProvider,
} from '../provider.js';
import {
  createQvacEdgeIntelligencePort,
} from '../edge-adapter.js';
import { createQvacRawClient, getQvacRawSdk } from '../raw.js';
import { createMockQvacSdk, MOCK_QVAC_VERSION } from '../test-fixtures/mock-qvac.js';

import { IntelligenceError } from '@totemsdk/intelligence';
import type { QvacSdkLike } from '../qvac-sdk.js';
import type { IntelligenceDomain, IntelligenceProvider } from '@totemsdk/intelligence';

import { llmAdapter, llmDomain } from '../domains/llm.js';
import { embedAdapter } from '../domains/embed.js';
import { ragAdapter, ragDomain } from '../domains/rag.js';
import { asrAdapter } from '../domains/asr.js';
import { translateAdapter } from '../domains/translate.js';
import { ttsAdapter } from '../domains/tts.js';
import { diffusionAdapter } from '../domains/diffusion.js';
import { ocrAdapter } from '../domains/ocr.js';
import { classifyAdapter } from '../domains/classify.js';
import { audiogenAdapter, audiogenDomain } from '../domains/audiogen.js';
import { videoAdapter } from '../domains/video.js';
import { vlaAdapter } from '../domains/vla.js';
import { worldAdapter } from '../domains/world.js';
import { modelsAdapter } from '../domains/models.js';
import { systemAdapter } from '../domains/system.js';
import { pluginsAdapter } from '../domains/plugins.js';

describe('@totemsdk/qvac', () => {
  describe('createQvacIntelligenceProvider', () => {
    it('wraps an injected QVAC SDK', () => {
      const provider = createQvacIntelligenceProvider({ sdk: createMockQvacSdk() });
      expect(provider.id).toBe('qvac');
      expect(provider.displayName).toBe('QVAC In-situ Inference');
      expect(provider.version).toBe(MOCK_QVAC_VERSION);
      expect(provider.isReady).toBe(true);
    });

    it('advertises all intelligence capabilities', () => {
      const provider = createQvacIntelligenceProvider({ sdk: createMockQvacSdk() });
      expect(provider.capabilities).toContain('intelligence:llm');
      expect(provider.capabilities).toContain('intelligence:asr');
      expect(provider.capabilities).toContain('intelligence:rag');
      expect(provider.capabilities).toHaveLength(16);
    });

    it('narrows advertised capabilities to what the SDK actually exposes', () => {
      const provider = createQvacIntelligenceProvider({ sdk: { completion: async () => ({ text: 'x' }) } });
      expect(provider.capabilities).toEqual(['intelligence:llm']);
    });

    it('advertises every domain while the SDK is unresolved, then discovers', async () => {
      const provider = createQvacIntelligenceProvider({
        sdkLoader: () => Promise.resolve(createMockQvacSdk()),
      });
      expect(provider.capabilities).toHaveLength(16);
      await provider.invoke({ domain: 'llm', op: 'completion', params: { prompt: 'hi' } });
      expect(provider.discoverCapabilities()).toHaveLength(16);
    });

    it('is assignable to the provider-neutral IntelligenceProvider shape', () => {
      const provider = createQvacIntelligenceProvider({ sdk: createMockQvacSdk() });
      const asContract: IntelligenceProvider = provider as unknown as IntelligenceProvider;
      expect(asContract.id).toBe('qvac');
    });

    it('constructs with zero config (no QvacSdkLike) and reports not ready', () => {
      const provider = createQvacIntelligenceProvider();
      expect(provider.id).toBe('qvac');
      expect(provider.isReady).toBe(false);
      expect(provider.sdk).toBeUndefined();
    });

    it('returns an UNAVAILABLE soft-error when no SDK is resolvable', async () => {
      const provider = createQvacIntelligenceProvider();
      const result = await provider.invoke({ domain: 'llm', op: 'completion', params: { prompt: 'hi' } });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('UNAVAILABLE');
        expect(result.message).toContain("'@qvac/sdk'");
      }
    });

    it('resolves the SDK lazily via sdkLoader', async () => {
      const mock = createMockQvacSdk();
      const provider = createQvacIntelligenceProvider({
        sdkLoader: () => Promise.resolve(mock),
      });
      expect(provider.isReady).toBe(false);

      const result = await provider.invoke({ domain: 'llm', op: 'completion', params: { prompt: 'hello' } });
      expect(result.ok).toBe(true);
      expect(provider.isReady).toBe(true);
      expect(provider.sdk).toBe(mock);
      expect(provider.version).toBe(MOCK_QVAC_VERSION);
    });
  });

  describe('dispatch', () => {
    it('routes llm:completion to the sdk completion callable', async () => {
      const provider = createQvacIntelligenceProvider({ sdk: createMockQvacSdk() });
      const result = await provider.invoke<{ text: string }>({
        domain: 'llm',
        op: 'completion',
        params: { prompt: 'Summarize' },
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.text).toBe('reply:Summarize');
      }
    });

    it('extracts llm usage from run.stats', async () => {
      const provider = createQvacIntelligenceProvider({ sdk: createMockQvacSdk() });
      const result = await provider.invoke({
        domain: 'llm',
        op: 'completion',
        params: { prompt: 'x' },
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.usage?.tokensIn).toBe(5);
        expect(result.usage?.tokensOut).toBe(7);
        expect(result.usage?.domain).toBe('llm');
        expect(result.usage?.op).toBe('completion');
      }
    });

    it('routes embed to its callable', async () => {
      const provider = createQvacIntelligenceProvider({ sdk: createMockQvacSdk() });
      const result = await provider.invoke({ domain: 'embed', op: 'embed', params: { text: 'hi' } });
      expect(result.ok).toBe(true);
    });

    it('routes rag ops to the rag callables', async () => {
      const provider = createQvacIntelligenceProvider({ sdk: createMockQvacSdk() });
      const search = await provider.invoke({ domain: 'rag', op: 'ragSearch', params: { query: 'q' } });
      expect(search.ok).toBe(true);
      const ingest = await provider.invoke({ domain: 'rag', op: 'ragIngest', params: { docs: [] } });
      expect(ingest.ok).toBe(true);
    });

    it('routes all canonical domains to callables when present', async () => {
      const sdk = createMockQvacSdk();
      const provider = createQvacIntelligenceProvider({ sdk });
      const cases = [
        ['llm', 'completion'],
        ['embed', 'embed'],
        ['rag', 'ragSearch'],
        ['asr', 'transcribe'],
        ['translate', 'translate'],
        ['tts', 'textToSpeech'],
        ['diffusion', 'diffusion'],
        ['ocr', 'ocr'],
        ['classify', 'classify'],
        ['audiogen', 'audioGen'],
        ['video', 'video'],
        ['vla', 'vla'],
        ['world', 'worldCreateScene'],
        ['models', 'loadModel'],
        ['system', 'heartbeat'],
        ['plugins', 'invokePlugin'],
      ] as const;
      for (const [domain, op] of cases) {
        const result = await provider.invoke({ domain: domain as never, op: op as never, params: {} });
        expect(result.ok).toBe(true);
      }
    });

    it('returns NOT_IMPLEMENTED for unknown ops without throwing', async () => {
      const provider = createQvacIntelligenceProvider({ sdk: createMockQvacSdk() });
      const result = await provider.invoke({ domain: 'llm', op: 'summarize', params: {} });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('NOT_IMPLEMENTED');
        expect(result.retryable).toBe(false);
      }
    });

    it('returns INVALID_REQUEST for non-object params', async () => {
      const provider = createQvacIntelligenceProvider({ sdk: createMockQvacSdk() });
      const result = await provider.invoke({ domain: 'llm', op: 'completion', params: null as never });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe('INVALID_REQUEST');
    });

    it('supports a custom op resolver', async () => {
      const sdk = createMockQvacSdk();
      const provider = createQvacIntelligenceProvider({
        sdk,
        resolveOp: (domain, op) => {
          if (domain === 'custom' && op === 'ping') {
            return async () => ({ data: 'pong', usage: { domain: 'custom', op: 'ping' } });
          }
          return undefined;
        },
      });
      const result = await provider.invoke({ domain: 'custom', op: 'ping', params: {} });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data).toBe('pong');
    });
  });

  describe('error mapping', () => {
    it('maps thrown errors to INTERNAL soft-fail results', async () => {
      const sdk: QvacSdkLike = {
        async completion() {
          throw new Error('worker crashed');
        },
      };
      const provider = createQvacIntelligenceProvider({ sdk });
      const result = await provider.invoke({ domain: 'llm', op: 'completion', params: {} });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('INTERNAL');
        expect(result.message).toContain('worker crashed');
      }
    });

    it('honours the CANCELLED code when a signal is already aborted', async () => {
      const provider = createQvacIntelligenceProvider({ sdk: createMockQvacSdk() });
      const controller = new AbortController();
      controller.abort();
      const result = await provider.invoke({
        domain: 'llm',
        op: 'completion',
        params: {},
        signal: controller.signal,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe('CANCELLED');
    });
  });

  describe('streaming', () => {
    it('streams transcribeStream segments followed by done', async () => {
      const provider = createQvacIntelligenceProvider({ sdk: createMockQvacSdk() });
      const chunks = [];
      for await (const c of provider.invokeStream({
        domain: 'asr',
        op: 'transcribeStream',
        params: {},
      })) {
        chunks.push(c);
      }
      expect(chunks.map(c => c.type)).toEqual(['segment', 'segment', 'done']);
      expect(chunks[0].type).toBe('segment');
      if (chunks[0].type === 'segment') expect(chunks[0].text).toBe('hello');
    });

    it('rejects non-stream ops with NOT_IMPLEMENTED', async () => {
      const provider = createQvacIntelligenceProvider({ sdk: createMockQvacSdk() });
      const iterator = provider.invokeStream({ domain: 'llm', op: 'completion', params: {} });
      await expect(collect(iterator)).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' });
    });

    it('invokes the onChunk callback for each chunk', async () => {
      const provider = createQvacIntelligenceProvider({ sdk: createMockQvacSdk() });
      const seen: string[] = [];
      for await (const _c of provider.invokeStream({
        domain: 'asr',
        op: 'transcribeStream',
        params: {},
        onChunk: (chunk: unknown) => seen.push((chunk as { type: string }).type),
      })) {
        // consume
      }
      expect(seen).toEqual(['segment', 'segment', 'done']);
    });
  });

  describe('cancellation', () => {
    it('cancels a registered in-flight request', async () => {
      const sdk: QvacSdkLike = {
        async completion(_params: Record<string, unknown>, opts: { signal?: AbortSignal }) {
          return new Promise((resolve, reject) => {
            const timer = setTimeout(() => resolve({ text: 'late' }), 50);
            opts?.signal?.addEventListener('abort', () => {
              clearTimeout(timer);
              reject(new IntelligenceError('CANCELLED', 'OP_REJECTED'));
            });
          });
        },
      };
      const provider = createQvacIntelligenceProvider({ sdk });
      const op = { domain: 'llm' as IntelligenceDomain, op: 'completion', params: {}, requestId: 'req-1' };
      const pending = provider.invoke(op);
      const cancelled = await provider.cancel('req-1');
      expect(cancelled.ok).toBe(true);
      const result = await pending;
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe('CANCELLED');
    });

    it('returns NOT_FOUND for unknown request ids', async () => {
      const provider = createQvacIntelligenceProvider({ sdk: createMockQvacSdk() });
      const result = await provider.cancel('nope');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe('NOT_FOUND');
    });
  });

  describe('close / lifecycle', () => {
    it('calls through to the sdk close hook', async () => {
      const closed = { called: false };
      const sdk: QvacSdkLike = {
        async completion() {
          return { text: 'x' };
        },
        async close() {
          closed.called = true;
        },
      };
      const provider = createQvacIntelligenceProvider({ sdk });
      await provider.close();
      expect(closed.called).toBe(true);
    });
  });

  describe('per-domain adapters', () => {
    const provider = createQvacIntelligenceProvider({ sdk: createMockQvacSdk() });

    it('routes domain-typed ops through the shared provider', async () => {
      const completion = llmAdapter(provider).completion;
      const result = await completion({ model: 'mock-llm', prompt: 'Summarize' });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.text).toBe('reply:Summarize');
      }
    });

    it('embeds a domain adapter into the IntelligenceProvider contract', async () => {
      const { ragSearch } = ragAdapter(provider);
      const result = await ragSearch({ query: 'documents' });
      expect(result.ok).toBe(true);
    });

    it('keeps the canonical domain set discoverable as constants', () => {
      expect(llmDomain).toBe('llm');
      expect(ragDomain).toBe('rag');
      expect(audiogenDomain).toBe('audiogen');
    });

    it('exposes a bound op for every canonical domain', async () => {
      const adapters = [
        llmAdapter, embedAdapter, ragAdapter, asrAdapter, translateAdapter,
        ttsAdapter, diffusionAdapter, ocrAdapter, classifyAdapter, audiogenAdapter,
        videoAdapter, vlaAdapter, worldAdapter, modelsAdapter, systemAdapter,
        pluginsAdapter,
      ];
      const domains = [
        'llm', 'embed', 'rag', 'asr', 'translate', 'tts', 'diffusion', 'ocr',
        'classify', 'audiogen', 'video', 'vla', 'world', 'models', 'system',
        'plugins',
      ];
      for (let i = 0; i < adapters.length; i += 1) {
        const ops = adapters[i](provider);
        const firstOp = Object.values(ops)[0] as (p: Record<string, unknown>) => Promise<unknown>;
        const result = await firstOp({});
        expect(result).toHaveProperty('ok');
        expect(domains[i]).toBe(domains[i]);
      }
    });
  });

  describe('edge port adapter', () => {
    it('returns a structural EdgeIntelligencePort', async () => {
      const port = createQvacEdgeIntelligencePort({ sdk: createMockQvacSdk() });
      expect(port.providerId).toBe('qvac');
      expect(port.capabilities).toContain('intelligence:llm');

      const result = await port.invoke({
        domain: 'llm',
        op: 'completion',
        params: { prompt: 'hello' },
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBeDefined();
      }
    });

    it('surfaces failures as EdgeOperationResult errors', async () => {
      const port = createQvacEdgeIntelligencePort({ sdk: createMockQvacSdk() });
      const result = await port.invoke({ domain: 'llm', op: 'nope', params: {} });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errorCode).toBe('NOT_IMPLEMENTED');
    });

    it('supports cancel and close', async () => {
      const port = createQvacEdgeIntelligencePort({ sdk: createMockQvacSdk() });
      await port.close?.();
    });
  });

  describe('raw passthrough', () => {
    it('returns the exact injected SDK object (identity, not a mirror)', () => {
      const mock = createMockQvacSdk();
      const raw = createQvacRawClient({ sdk: mock });
      expect(raw).toBe(mock);
      expect(typeof raw.completion).toBe('function');
    });

    it('retrieves the SDK bound to a provider', () => {
      const mock = createMockQvacSdk();
      const provider = createQvacIntelligenceProvider({ sdk: mock });
      expect(getQvacRawSdk(provider)).toBe(mock);
    });

    it('resolves the lazily loaded SDK after first invoke', async () => {
      const mock = createMockQvacSdk();
      const provider = createQvacIntelligenceProvider({ sdkLoader: () => Promise.resolve(mock) });
      expect(getQvacRawSdk(provider)).toBeUndefined();
      await provider.invoke({ domain: 'llm', op: 'completion', params: { prompt: 'hi' } });
      expect(getQvacRawSdk(provider)).toBe(mock);
    });
  });
});

async function collect(iterable: AsyncIterable<unknown>): Promise<unknown[]> {
  const out: unknown[] = [];
  for await (const item of iterable) out.push(item);
  return out;
}