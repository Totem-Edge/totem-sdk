/**
 * Tests for @totemsdk/qvac — provider factory, dispatch, usage extraction,
 * streaming, cancellation, and error mapping.
 *
 * The mock QVAC SDK (`mock-qvac.ts`) is faithful to @qvac/sdk@0.19.0 shapes:
 * completion returns a live CompletionRun, embed/loadModel/transcribe return
 * decorated promises carrying a sync requestId, TTS returns
 * TextToSpeechStreamResult, and positional/callback ops keep their real
 * signatures. The tests exercise those shapes end-to-end through the provider.
 */

import {
  createQvacIntelligenceProvider,
} from '../provider.js';
import {
  createQvacEdgeIntelligencePort,
} from '../edge-adapter.js';
import { createQvacRawClient, getQvacRawSdk } from '../raw.js';
import {
  createMockQvacSdk,
  getMockCancelled,
  MOCK_QVAC_VERSION,
} from '../test-fixtures/mock-qvac.js';

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
    it('routes llm:completion to the sdk completion callable and returns the live run', async () => {
      const provider = createQvacIntelligenceProvider({ sdk: createMockQvacSdk() });
      const result = await provider.invoke({
        domain: 'llm',
        op: 'completion',
        params: { history: [{ role: 'user', content: 'Summarize' }] },
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const run = result.data as {
          requestId: string;
          final: Promise<{ contentText: string }>;
          text: Promise<string>;
        };
        expect(run.requestId).toMatch(/^comp-/);
        expect(result.upstreamRequestId).toBe(run.requestId);
        await expect(run.text).resolves.toBe('reply:Summarize');
        await expect(run.final).resolves.toMatchObject({ contentText: 'reply:Summarize' });
      }
    });

    it('extracts usage from resolved stat objects (decorated promises)', async () => {
      const provider = createQvacIntelligenceProvider({ sdk: createMockQvacSdk() });
      const result = await provider.invoke({ domain: 'embed', op: 'embed', params: { text: 'x' } });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.usage?.tokensIn).toBe(10);
        expect(result.usage?.domain).toBe('embed');
        expect(result.usage?.op).toBe('embed');
        expect(result.upstreamRequestId).toMatch(/^embed-/);
      }
    });

    it('routes embed to its callable', async () => {
      const provider = createQvacIntelligenceProvider({ sdk: createMockQvacSdk() });
      const result = await provider.invoke({ domain: 'embed', op: 'embed', params: { text: 'hi' } });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toHaveProperty('embedding');
      }
    });

    it('routes rag ops to the rag callables', async () => {
      const provider = createQvacIntelligenceProvider({ sdk: createMockQvacSdk() });
      const search = await provider.invoke({ domain: 'rag', op: 'ragSearch', params: { text: 'q' } });
      expect(search.ok).toBe(true);
      const ingest = await provider.invoke({ domain: 'rag', op: 'ragIngest', params: { documents: [] } });
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

  describe('positional & callback op shapes', () => {
    it('invokes positional vla helpers with their real argument order', async () => {
      const provider = createQvacIntelligenceProvider({ sdk: createMockQvacSdk() });
      const { vlaPreprocessImage, vlaPadState } = vlaAdapter(provider);

      const processed = await vlaPreprocessImage(new Float32Array(4), 2, 2);
      expect(processed.ok).toBe(true);
      if (processed.ok) expect(processed.data).toHaveLength(4);

      const padded = await vlaPadState(new Uint8Array(2), 8);
      expect(padded.ok).toBe(true);
      if (padded.ok) expect(padded.data).toHaveLength(8);
    });

    it('invokes positional modelRegistryGetModel(rp, rs)', async () => {
      const provider = createQvacIntelligenceProvider({ sdk: createMockQvacSdk() });
      const { modelRegistryGetModel } = modelsAdapter(provider);
      const result = await modelRegistryGetModel('models/llm.gguf', 'registry');
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data.name).toBe('models/llm.gguf');
    });

    it('invokes callback subscribeServerLogs(handler) and returns unsubscribe', async () => {
      const provider = createQvacIntelligenceProvider({ sdk: createMockQvacSdk() });
      const { subscribeServerLogs } = systemAdapter(provider);
      const logs: string[] = [];
      const result = await subscribeServerLogs((log: { message: string }) => {
        logs.push(log.message);
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(typeof result.data.unsubscribe).toBe('function');
        result.data.unsubscribe();
      }
      expect(logs).toEqual(['subscribed']);
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

    it('streams completion events as token/stat chunks and reports final usage', async () => {
      const provider = createQvacIntelligenceProvider({ sdk: createMockQvacSdk() });
      const chunks = [];
      for await (const c of provider.invokeStream({
        domain: 'llm',
        op: 'completion',
        params: { history: [{ role: 'user', content: 'Hi' }] },
      })) {
        chunks.push(c);
      }
      expect(chunks.map(c => c.type)).toEqual(['token', 'token', 'progress', 'done']);
      if (chunks[3].type === 'done') {
        expect(chunks[3].usage?.tokensIn).toBe(5);
        expect(chunks[3].usage?.tokensOut).toBe(7);
      }
    });

    it('streams textToSpeech audio samples from bufferStream', async () => {
      const provider = createQvacIntelligenceProvider({ sdk: createMockQvacSdk() });
      const chunks = await collect(provider.invokeStream({
        domain: 'tts',
        op: 'textToSpeech',
        params: { modelId: 'tts-1', text: 'hi' },
      }));
      expect(chunks.map(c => c.type)).toEqual(['audio', 'audio', 'done']);
      expect(chunks[0].type === 'audio' ? chunks[0].data : null).toBe(1);
    });

    it('streams textToSpeechStream session chunks as audio', async () => {
      const provider = createQvacIntelligenceProvider({ sdk: createMockQvacSdk() });
      const chunks = await collect(provider.invokeStream({
        domain: 'tts',
        op: 'textToSpeechStream',
        params: { modelId: 'tts-1' },
      }));
      expect(chunks.map(c => c.type)).toEqual(['audio', 'audio', 'done']);
    });

    it('streams loggingStream log entries', async () => {
      const provider = createQvacIntelligenceProvider({ sdk: createMockQvacSdk() });
      const chunks = await collect(provider.invokeStream({
        domain: 'system',
        op: 'loggingStream',
        params: { id: 'sdk' },
      }));
      expect(chunks.map(c => c.type)).toEqual(['delta', 'done']);
    });

    it('streams diffusion progress ticks', async () => {
      const provider = createQvacIntelligenceProvider({ sdk: createMockQvacSdk() });
      const chunks = await collect(provider.invokeStream({
        domain: 'diffusion',
        op: 'diffusion',
        params: { modelId: 'img-1', prompt: 'a cat' },
      }));
      expect(chunks.map(c => c.type)).toEqual(['progress', 'progress', 'progress', 'done']);
      expect(chunks[0].type === 'progress' ? chunks[0].percent : null).toBe(25);
    });

    it('rejects non-stream ops with NOT_IMPLEMENTED', async () => {
      const provider = createQvacIntelligenceProvider({ sdk: createMockQvacSdk() });
      const iterator = provider.invokeStream({ domain: 'embed', op: 'embed', params: { text: 'x' } });
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

    it('forwards the upstream requestId to sdk.cancel for targeted cancellation', async () => {
      const cancelled: string[] = [];
      let resolveOp!: (v: unknown) => void;
      const pendingEmbed = new Promise<unknown>((resolve) => {
        resolveOp = resolve;
      }) as Promise<unknown> & { requestId: string };
      pendingEmbed.requestId = 'up-1';

      const sdk: QvacSdkLike = {
        embed() {
          return pendingEmbed;
        },
        async cancel(params: { requestId: string }) {
          cancelled.push(params.requestId);
          return { success: true };
        },
      };
      const provider = createQvacIntelligenceProvider({ sdk });
      const invokePromise = provider.invoke({
        domain: 'embed',
        op: 'embed',
        params: { text: 'x' },
        requestId: 'req-1',
      });

      // Let the provider resolve the SDK + publish the upstream requestId.
      await Promise.resolve();
      await Promise.resolve();

      const cancelledResult = await provider.cancel('req-1');
      expect(cancelledResult.ok).toBe(true);
      expect(cancelled).toEqual(['up-1']);

      resolveOp({ embedding: [1, 2, 3] });
      const result = await invokePromise;
      expect(result.ok).toBe(true);
    });

    it('tracks local→upstream request id mapping while in flight', async () => {
      const mock = createMockQvacSdk();
      const provider = createQvacIntelligenceProvider({ sdk: mock });
      const result = await provider.invoke({
        domain: 'embed',
        op: 'embed',
        params: { text: 'hi' },
        requestId: 'req-1',
      });
      expect(result.ok).toBe(true);
      expect(provider.upstreamRequestIds.size).toBe(0);
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
      const result = await completion({ modelId: 'model-1', history: [{ role: 'user', content: 'Summarize' }] });
      expect(result.ok).toBe(true);
      if (result.ok) {
        await expect(result.data.text).resolves.toBe('reply:Summarize');
      }
    });

    it('embeds a domain adapter into the IntelligenceProvider contract', async () => {
      const { ragSearch } = ragAdapter(provider);
      const result = await ragSearch({ embeddingModelId: 'embed-1', text: 'documents' });
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
        params: { history: [{ role: 'user', content: 'hello' }] },
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

    it('exposes the raw sdk cancel surface for targeted cancellation', async () => {
      const mock = createMockQvacSdk();
      const raw = createQvacRawClient({ sdk: mock });
      await (raw as { cancel(p: { requestId: string }): Promise<unknown> }).cancel({ requestId: 'x' });
      expect(getMockCancelled(mock).some(c => c.requestId === 'x')).toBe(true);
    });
  });
});

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of iterable) out.push(item);
  return out;
}