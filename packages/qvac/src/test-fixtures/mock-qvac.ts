/**
 * Shared mock of the QVAC SDK surface used across @totemsdk/qvac tests.
 *
 * Faithful to @qvac/sdk@0.19.0 shapes, not to the adapter's flattened forms:
 *  - completion → live CompletionRun (requestId + events + final + tokenStream)
 *  - transcribe/embed/loadModel/downloadAsset/ragIngest → decorated promises
 *    carrying a synchronous `requestId`
 *  - translate → handle object with async tokenStream/translations/text
 *  - textToSpeech → TextToSpeechStreamResult (bufferStream + done)
 *  - textToSpeechStream/bciTranscribeStream → duplex sessions
 *  - vlaPreprocessImage/vlaPadState/modelRegistryGetModel → positional
 *  - subscribeServerLogs → handler in, unsubscribe fn out
 *  - diffusion/upscale/audioGen/video → progressStream + outputs promises
 *  - ocr → blockStream
 */

import type { QvacSdkLike } from '../qvac-sdk.js';

type Decorated<T> = Promise<T> & { requestId: string };

function decorated<T>(value: T, requestId: string): Decorated<T> {
  const promise = Promise.resolve(value) as Decorated<T>;
  promise.requestId = requestId;
  return promise;
}

function rid(prefix = 'mock'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createMockQvacSdk(): QvacSdkLike {
  const __cancelled: Array<{ requestId?: string; modelId?: string }> = [];

  return {
    id: 'qvac',
    version: '0.19.0',
    __cancelled,

    completion(params: Record<string, unknown>) {
      const requestId = rid('comp');
      const content = `reply:${String((params.history as Array<{ content?: string }> | undefined)?.[0]?.content ?? '')}`;
      const final = Promise.resolve({
        contentText: content,
        toolCalls: [] as Array<{ id: string; name: string; arguments: Record<string, unknown> }>,
        stopReason: 'eos' as const,
        raw: { fullText: content },
        stats: { tokensIn: 5, tokensOut: 7, durationMs: 12 },
      });
      return {
        requestId,
        final,
        events: (async function* () {
          yield { type: 'contentDelta', seq: 1, text: content.slice(0, Math.ceil(content.length / 2)) };
          yield { type: 'contentDelta', seq: 2, text: content.slice(Math.ceil(content.length / 2)) };
          yield { type: 'completionStats', seq: 3, stats: { tokensIn: 5, tokensOut: 7 } };
          yield { type: 'completionDone', seq: 4, stopReason: 'eos' };
        })(),
        tokenStream: (async function* () {
          yield content;
        })(),
        toolCallStream: (async function* () {})(),
        text: final.then(f => f.contentText),
        toolCalls: final.then(f => f.toolCalls),
        stats: final.then(f => f.stats),
      };
    },

    async batchCompletion() {
      return {
        requestId: rid('batch'),
        events: (async function* () {})(),
        final: Promise.resolve({ text: 'batch' }),
      };
    },

    async finetune() {
      return {
        requestId: rid('ft'),
        progressStream: (async function* () {})(),
        result: Promise.resolve({}),
      };
    },

    embed(params: Record<string, unknown>) {
      const input = String(params.text ?? '');
      const embedding = Array.from({ length: 8 }, (_, i) => input.length + i);
      const requestId = rid('embed');
      if (Array.isArray(params.text)) {
        return decorated(
          { embedding: Array.from({ length: (params.text as string[]).length }, () => embedding), stats: { tokensIn: 10, tokensOut: 0, durationMs: 5 } },
          requestId,
        );
      }
      return decorated({ embedding, stats: { tokensIn: 10, tokensOut: 0, durationMs: 5 } }, requestId);
    },

    async ragChunk(params: Record<string, unknown>) {
      return [{ id: rid('chunk'), content: String(params.content ?? '') }];
    },

    ragIngest() {
      return decorated({ processed: [{ id: 'doc-1', status: 'ok' as const }], droppedIndices: [] }, rid('ragi'));
    },

    async ragSearch() {
      return [{ doc: { id: 'doc-1', content: 'searched' }, score: 0.9, details: { kind: 'similarity' } }];
    },

    ragSaveEmbeddings() {
      return decorated([{ id: 'chunk-1', status: 'ok' as const }], rid('rags'));
    },

    async ragDeleteEmbeddings() {
      return undefined;
    },

    ragReindex() {
      return decorated({ reindexed: true }, rid('ragr'));
    },

    async ragListWorkspaces() {
      return [{ id: 'ws-1', name: 'default', open: true, documents: 3 }];
    },

    async ragCloseWorkspace() {
      return undefined;
    },

    async ragDeleteWorkspace() {
      return undefined;
    },

    transcribe(params: Record<string, unknown>) {
      return decorated(`transcript:${String(params.language ?? 'en')}`, rid('tr'));
    },

    async *transcribeStream() {
      yield { type: 'segment', text: 'hello' };
      yield { type: 'segment', text: 'world' };
    },

    bciTranscribe(params: Record<string, unknown>) {
      return decorated(`bci:${String(params.language ?? 'en')}`, rid('bci'));
    },

    bciTranscribeStream() {
      const session = {
        stats: Promise.resolve(undefined),
        write(_chunk: Uint8Array): void {},
        end(): void {},
        destroy(): void {},
        async *[Symbol.asyncIterator]() {
          yield { type: 'transcript', text: 'bci-hello' };
          yield { type: 'transcript', text: 'bci-world' };
        },
      };
      return Promise.resolve(session);
    },

    translate(params: Record<string, unknown>) {
      const text = String(params.text ?? '');
      const translated = `TR:${text}`;
      return {
        requestId: rid('trsl'),
        tokenStream: (async function* () {
          yield translated;
        })(),
        stats: Promise.resolve({ tokensIn: 2, tokensOut: 2, durationMs: 5 }),
        translations: Promise.resolve([translated]),
        text: Promise.resolve(translated),
      };
    },

    textToSpeech() {
      return {
        bufferStream: (async function* () {
          yield 1;
          yield 2;
        })(),
        buffer: Promise.resolve([1, 2]),
        done: Promise.resolve(true),
      };
    },

    textToSpeechStream() {
      const session = {
        write(_fragment: string | Uint8Array): void {},
        end(): void {},
        destroy(): void {},
        async *[Symbol.asyncIterator]() {
          yield { type: 'ttsStreamChunk', buffer: new Uint8Array(2), chunkIndex: 0, sentenceChunk: 'hi' };
          yield { type: 'ttsStreamChunk', buffer: new Uint8Array(2), chunkIndex: 1, sentenceChunk: ' ' };
        },
      };
      return Promise.resolve(session);
    },

    diffusion() {
      return {
        progressStream: (async function* () {
          yield { step: 1, totalSteps: 4, elapsedMs: 10 };
          yield { step: 2, totalSteps: 4, elapsedMs: 20 };
          yield { step: 4, totalSteps: 4, elapsedMs: 40 };
        })(),
        outputs: Promise.resolve([new Uint8Array(4)]),
        stats: Promise.resolve(undefined),
      };
    },

    upscale() {
      return {
        progressStream: (async function* () {
          yield { step: 1, totalSteps: 2, elapsedMs: 5 };
        })(),
        outputs: Promise.resolve([new Uint8Array(4)]),
        stats: Promise.resolve(undefined),
      };
    },

    ocr() {
      return {
        blockStream: (async function* () {
          yield [{ text: 'OCR-001', confidence: 0.9 }];
          yield [{ text: 'OCR-002', confidence: 0.8 }];
        })(),
        blocks: Promise.resolve([{ text: 'OCR-001', confidence: 0.9 }]),
        stats: Promise.resolve({ recognitionTime: 3 }),
      };
    },

    async classify() {
      return [{ text: 'ok-class', value: 0.95 }];
    },

    audioGen() {
      return {
        requestId: rid('audio'),
        progressStream: (async function* () {
          yield { step: 1, totalSteps: 2, elapsedMs: 2 };
        })(),
        outputs: Promise.resolve([new Uint8Array(8)]),
        stats: Promise.resolve(undefined),
      };
    },

    video() {
      return {
        requestId: rid('vid'),
        progressStream: (async function* () {
          yield { step: 1, totalSteps: 3, elapsedMs: 5 };
        })(),
        outputs: Promise.resolve([new Uint8Array(8)]),
        stats: Promise.resolve(undefined),
      };
    },

    vla() {
      return Promise.resolve({ actions: 'grasp', actionDim: 7, chunkSize: 64, stats: { total_ms: 3 } });
    },

    async vlaHparams() {
      return {
        backendName: null,
        hparams: {
          chunkSize: 64, actionDim: 7, maxActionDim: 11, maxStateDim: 1024,
          tokenizerMaxLength: 2048, visionImageSize: 224, numCameras: 1,
        },
      };
    },

    async vlaSetEmbodiment() {
      return {
        hparams: {
          chunkSize: 64, actionDim: 7, maxActionDim: 11, maxStateDim: 1024,
          tokenizerMaxLength: 2048, visionImageSize: 224, numCameras: 1,
          stateInputMode: 'discrete', selectedEmbodimentTag: 'FR3_Left',
        },
      };
    },

    vlaPreprocessImage(_pixels: Float32Array, width: number, height: number) {
      return Promise.resolve(new Uint8Array(width * height));
    },

    vlaPadState(_state: Uint8Array, targetDim?: number) {
      return Promise.resolve(new Uint8Array(targetDim ?? 0));
    },

    async worldCreateScene(params: Record<string, unknown>) {
      return { sceneId: String(params.username ?? 'scene-1'), scene: { title: 'mock' } };
    },

    async worldStep() {
      return { result: 'moved', events: [] };
    },

    loadModel() {
      return decorated('model-loaded', rid('load'));
    },

    async unloadModel() {
      return undefined;
    },

    async getModelInfo() {
      return { modelId: 'mock-llm', modelType: 'llm', modelPath: '/tmp/mock-llm' };
    },

    async getLoadedModelInfo() {
      return { modelId: 'mock-llm', modelType: 'llm', modelPath: '/tmp/mock-llm' };
    },

    async deleteCache() {
      return { success: true };
    },

    downloadAsset() {
      return decorated('asset-downloaded', rid('dl'));
    },

    async assessModelFit() {
      return { fits: true, reason: 'mock-fit' };
    },

    async modelRegistryList() {
      return [{ name: 'mock-llm', displayName: 'Mock LLM', engine: 'llamacpp' }];
    },

    async modelRegistrySearch() {
      return [{ name: 'mock-llm', displayName: 'Mock LLM', engine: 'llamacpp' }];
    },

    modelRegistryGetModel(registryPath: string, _registrySource: string) {
      return Promise.resolve({ name: registryPath, displayName: registryPath, engine: 'llamacpp' });
    },

    async suspend() {
      return undefined;
    },

    async resume() {
      return undefined;
    },

    async state() {
      return { running: true };
    },

    async heartbeat() {
      return { status: 'ok' as const, uptimeMs: 1234 };
    },

    async getSystemResources() {
      return { cpu: 'arm64', gpu: 'none', drivers: { metal: 'available' } };
    },

    async *loggingStream() {
      yield { type: 'loggingStream', id: 'sdk', level: 'info', namespace: 'qvac.mock', message: 'mock booted', timestamp: 1 };
    },

    subscribeServerLogs(handler: (log: unknown) => void) {
      handler({ type: 'loggingStream', id: 'sdk', level: 'info', namespace: 'qvac.mock', message: 'subscribed', timestamp: 2 });
      return () => {
        __cancelled.push({ requestId: 'unsubscribed' });
      };
    },

    async cancel(params: { requestId?: string; modelId?: string }) {
      __cancelled.push({ requestId: params.requestId, modelId: params.modelId });
      return { success: true };
    },

    async invokePlugin(params: Record<string, unknown>) {
      return { plugin: params.handler, ok: true };
    },

    async *invokePluginStream() {
      yield { type: 'delta', data: { plugin: 'mock' } };
    },

    async close(): Promise<void> {
      return undefined;
    },
  };
}

export const MOCK_QVAC_VERSION = '0.19.0';

export function getMockCancelled(sdk: QvacSdkLike): Array<{ requestId?: string; modelId?: string }> {
  return (sdk as QvacSdkLike & { __cancelled?: Array<{ requestId?: string; modelId?: string }> }).__cancelled ?? [];
}