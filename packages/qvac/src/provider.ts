/**
 * @totemsdk/qvac — QVAC intelligence provider.
 *
 * Wraps a structural QVAC SDK surface into @totemsdk/intelligence's
 * provider-neutral contracts. The consumer injects the QVAC SDK (or mock);
 * the adapter never imports @qvac/sdk at module load.
 *
 * Design principle: the AI proposes, Totem authorizes. This provider is a
 * compute surface only — it cannot sign and never holds keys.
 */

import {
  INTELLIGENCE_DOMAINS,
  INTELLIGENCE_CAPABILITIES,
  INTELLIGENCE_OPS,
  IntelligenceError,
} from '@totemsdk/intelligence';

import type {
  IntelligenceCapability,
  IntelligenceDomain,
  IntelligenceOperation,
  IntelligenceOutcome,
  IntelligenceErrorResult,
  IntelligenceStreamChunk,
  IntelligenceStreamOperation,
  IntelligenceUsage,
} from '@totemsdk/intelligence';

import type {
  QvacCallResult,
  QvacOpHandler,
  QvacOpShape,
  QvacProviderOptions,
  QvacSdkLike,
  QvacUsageExtractor,
} from './qvac-sdk.js';
import { qvacOpShape } from './qvac-sdk.js';

const DOMAIN_FROM_OP: Record<string, IntelligenceDomain> = {
  completion: 'llm',
  batchCompletion: 'llm',
  finetune: 'llm',
  embed: 'embed',
  ragChunk: 'rag',
  ragIngest: 'rag',
  ragSearch: 'rag',
  ragSaveEmbeddings: 'rag',
  ragDeleteEmbeddings: 'rag',
  ragReindex: 'rag',
  ragListWorkspaces: 'rag',
  ragCloseWorkspace: 'rag',
  ragDeleteWorkspace: 'rag',
  transcribe: 'asr',
  transcribeStream: 'asr',
  bciTranscribe: 'asr',
  bciTranscribeStream: 'asr',
  translate: 'translate',
  textToSpeech: 'tts',
  textToSpeechStream: 'tts',
  diffusion: 'diffusion',
  upscale: 'diffusion',
  ocr: 'ocr',
  classify: 'classify',
  audioGen: 'audiogen',
  video: 'video',
  vla: 'vla',
  vlaHparams: 'vla',
  vlaSetEmbodiment: 'vla',
  vlaPreprocessImage: 'vla',
  vlaPadState: 'vla',
  worldCreateScene: 'world',
  worldStep: 'world',
  loadModel: 'models',
  unloadModel: 'models',
  getModelInfo: 'models',
  getLoadedModelInfo: 'models',
  deleteCache: 'models',
  downloadAsset: 'models',
  assessModelFit: 'models',
  modelRegistryList: 'models',
  modelRegistrySearch: 'models',
  modelRegistryGetModel: 'models',
  suspend: 'models',
  resume: 'models',
  state: 'models',
  heartbeat: 'system',
  getSystemResources: 'system',
  loggingStream: 'system',
  subscribeServerLogs: 'system',
  cancel: 'system',
  close: 'system',
  invokePlugin: 'plugins',
  invokePluginStream: 'plugins',
};

const STREAM_CAPABLE_OPS = new Set([
  'completion',
  'transcribeStream',
  'bciTranscribeStream',
  'textToSpeech',
  'textToSpeechStream',
  'loggingStream',
  'invokePluginStream',
  'diffusion',
  'upscale',
  'audioGen',
  'video',
  'ocr',
]);

let requestCounter = 0;

function nextRequestId(): string {
  requestCounter += 1;
  return `qvac-${Date.now().toString(36)}-${requestCounter.toString(36)}`;
}

/**
 * Default usage extractor — best-effort scan of common QVAC stat shapes.
 */
function defaultUsageExtractor(
  _domain: string,
  op: string,
  raw: unknown,
): Partial<IntelligenceUsage> | undefined {
  if (raw === null || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;

  const usage: {
    op: string;
    tokensIn?: number;
    tokensOut?: number;
    durationMs?: number;
    model?: string;
  } = { op };

  const stats = (obj.stats ??
    (obj.run && typeof obj.run === 'object' ? (obj.run as Record<string, unknown>).stats : undefined) ??
    obj.usage) as Record<string, unknown> | undefined;

  if (stats && typeof stats === 'object' && typeof (stats as { then?: unknown }).then !== 'function') {
    const tokensIn = stats.tokensIn ?? stats.inputTokens ?? stats.promptTokens ?? stats.cacheTokens;
    const tokensOut = stats.tokensOut ?? stats.outputTokens ?? stats.completionTokens ?? stats.generatedTokens ?? stats.emittedTokens;
    const durationMs = stats.durationMs ?? stats.elapsedMs ?? stats.duration;
    const model = stats.model ?? obj.model;
    if (tokensIn !== undefined) usage.tokensIn = Number(tokensIn);
    if (tokensOut !== undefined) usage.tokensOut = Number(tokensOut);
    if (durationMs !== undefined) usage.durationMs = Number(durationMs);
    if (typeof model === 'string') usage.model = model;
  } else {
    const model = obj.model;
    if (typeof model === 'string') usage.model = model;
  }

  if (usage.tokensIn === undefined && usage.tokensOut === undefined && usage.model === undefined) {
    return undefined;
  }
  return usage;
}

/**
 * Wrap a QVAC callable into a normalised QvacOpHandler.
 *
 * The wrapper is shape-aware: record ops receive `(params, opts)`, positional
 * ops receive `(...argKeys.map(k => params[k]), opts)`, and callback ops
 * receive the handler function and normalise the returned teardown to
 * `{ unsubscribe }`. The QVAC-side `requestId` is captured from the decorated
 * promise/run object before awaiting so targeted upstream cancellation works.
 */
function wrapCallable(
  fn: unknown,
  extractor: QvacUsageExtractor,
  shape: QvacOpShape,
  op: string,
): QvacOpHandler | undefined {
  if (typeof fn !== 'function') return undefined;

  const invoke = (
    params: Record<string, unknown>,
    opts: { signal?: AbortSignal },
  ): unknown => {
    if (shape.kind === 'positional') {
      const args = shape.argKeys.map(key => params[key]);
      return (fn as (...a: unknown[]) => unknown)(...args, opts);
    }
    if (shape.kind === 'callback') {
      return (fn as (handler: unknown) => unknown)(params[shape.paramKey]);
    }
    return (fn as (p: Record<string, unknown>, o?: { signal?: AbortSignal }) => unknown)(params, opts);
  };

  return async (params, opts) => {
    const signal = opts.signal;
    if (signal?.aborted) {
      throw new IntelligenceError('CANCELLED');
    }

    const rawPending = invoke(params, opts);
    const upstreamRequestId = extractUpstreamRequestId(rawPending);
    if (opts.requestIdBridge) {
      opts.requestIdBridge.upstream = upstreamRequestId;
    }

    if (shape.kind === 'callback') {
      const unsubscribe = rawPending;
      if (typeof unsubscribe !== 'function') {
        throw new IntelligenceError(
          'INTERNAL',
          `Operation '${op}' (callback shape) must return an unsubscribe function.`,
        );
      }
      return { data: { unsubscribe }, upstreamRequestId } as QvacCallResult;
    }

    const raw = await rawPending;
    const usage = extractor('', '', raw);
    return { data: raw, usage, upstreamRequestId } as QvacCallResult;
  };
}

function extractUpstreamRequestId(value: unknown): string | undefined {
  if (value === null || typeof value !== 'object') return undefined;
  const id = (value as { requestId?: unknown }).requestId;
  return typeof id === 'string' && id.length > 0 ? id : undefined;
}

/**
 * Factory: wrap a QVAC SDK surface into an @totemsdk/intelligence provider.
 *
 * The SDK is injected via `options.sdk`, resolved lazily via
 * `options.sdkLoader`, or required from the installed `@qvac/sdk` package at
 * first use. A normal app can construct the provider with zero configuration
 * when `@qvac/sdk` is installed; injection remains available for tests and
 * custom runtimes.
 */
export function createQvacIntelligenceProvider(
  options: QvacProviderOptions = {},
): {
  readonly id: string;
  readonly displayName: string;
  readonly version: string;
  readonly capabilities: IntelligenceCapability[];
  readonly isReady: boolean;
  readonly discoverCapabilities: () => IntelligenceCapability[];
  invoke<T = unknown>(op: IntelligenceOperation<T>): Promise<IntelligenceOutcome<T>>;
  invokeStream(op: IntelligenceStreamOperation): AsyncIterable<IntelligenceStreamChunk>;
  cancel(requestId: string): Promise<IntelligenceOutcome<void>>;
  close(): Promise<void>;
  readonly sdk?: QvacSdkLike;
  readonly activeRequests: ReadonlyMap<string, AbortController>;
  /** local requestId → QVAC-side requestId captured from the SDK result. */
  readonly upstreamRequestIds: ReadonlyMap<string, string>;
} {
  const { onLog } = options;
  const extractor = options.usageExtractor ?? defaultUsageExtractor;

  const activeRequests = new Map<string, AbortController>();
  /** local requestId → QVAC-side requestId, for targeted upstream cancel(). */
  const upstreamRequestIds = new Map<string, string>();

  const log = (level: string, message: string, context?: unknown) => {
    onLog?.(level, message, context);
  };

  // Lazy SDK resolution: injected → loader → required package (in that order).
  const sdkRef: { current?: QvacSdkLike } = {};
  if (options.sdk) sdkRef.current = options.sdk;

  let sdkPromise: Promise<QvacSdkLike> | undefined;
  async function resolveSdk(): Promise<QvacSdkLike> {
    if (sdkRef.current) return sdkRef.current;
    if (!sdkPromise) {
      sdkPromise = (async () => {
        if (options.sdkLoader) {
          sdkRef.current = (await options.sdkLoader()) ?? undefined;
        } else {
          sdkRef.current = tryRequireQvacSdk() ?? undefined;
        }
        if (!sdkRef.current) {
          throw new IntelligenceError(
            'UNAVAILABLE',
            "No QVAC SDK available. Inject options.sdk, provide options.sdkLoader (e.g. () => import('@qvac/sdk')), or install '@qvac/sdk' so it can be required lazily.",
          );
        }
        return sdkRef.current;
      })();
    }
    return sdkPromise;
  }

  const resolveOp = options.resolveOp ?? defaultOpResolver(sdkRef, extractor);

  const callAsOp = async <T,>(
    op: IntelligenceOperation<T>,
    requestId: string,
  ): Promise<IntelligenceOutcome<T>> => {
    if (!op.params || typeof op.params !== 'object') {
      return makeError(requestId, new IntelligenceError('INVALID_REQUEST', 'params must be an object'));
    }

    // Register the request synchronously so an immediate cancel() can find it.
    const controller = new AbortController();
    const external = op.signal;
    const abortFromEither = () => controller.abort();
    const abortFromSelf = () => external?.dispatchEvent?.(new Event('abort'));

    external?.addEventListener?.('abort', abortFromEither);
    controller.signal.addEventListener('abort', abortFromSelf);
    activeRequests.set(requestId, controller);

    // If the external signal was already aborted before we registered the
    // listener, abort the controller immediately.
    if (external?.aborted) controller.abort();

    try {
      try {
        await resolveSdk();
      } catch (err) {
        return makeError(requestId, err);
      }

      const handler = resolveOp(op.domain, op.op);
      if (!handler) {
        return makeError(requestId, new IntelligenceError(
          'NOT_IMPLEMENTED',
          `Operation '${op.op}' (domain '${op.domain}') is not implemented by this provider.`,
        ));
      }

      const timeoutMs = options.defaultTimeoutMs;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = timeoutMs
        ? new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              controller.abort();
              reject(new IntelligenceError('TIMEOUT', `Operation '${op.op}' timed out after ${timeoutMs}ms`));
            }, timeoutMs);
          })
        : undefined;

      let call: Promise<QvacCallResult>;
      const bridge: { upstream?: string } = {};
      try {
        call = handler(op.params, { signal: controller.signal, requestIdBridge: bridge });
      } catch (err) {
        return makeError(requestId, err);
      }
      // Publish the upstream requestId synchronously so cancel() can forward it
      // even while this call is still pending.
      if (bridge.upstream) {
        upstreamRequestIds.set(requestId, bridge.upstream);
      }

      const result = timeout ? await Promise.race([call, timeout]) : await call;
      if (timer) clearTimeout(timer);

      if (result.upstreamRequestId) {
        upstreamRequestIds.set(requestId, result.upstreamRequestId);
      }

      const usage = result.usage ?? extractor(op.domain, op.op, result.data);
      const domain = op.domain ?? DOMAIN_FROM_OP[op.op];
      const finalUsage: IntelligenceUsage | undefined =
        usage?.domain === undefined && domain
          ? { ...usage, domain, op: op.op } as IntelligenceUsage
          : usage as IntelligenceUsage | undefined;

      log('debug', `invoke ${op.domain}:${op.op} ok`, { requestId, usage: finalUsage });
      return {
        ok: true,
        requestId,
        data: result.data as T,
        usage: finalUsage,
        upstreamRequestId: result.upstreamRequestId,
      } as const;
    } catch (err) {
      return makeError(requestId, err);
    } finally {
      external?.removeEventListener?.('abort', abortFromEither);
      activeRequests.delete(requestId);
      upstreamRequestIds.delete(requestId);
    }
  };

  const provider = {
    id: 'qvac',
    displayName: 'QVAC In-situ Inference',
    get version(): string {
      return sdkRef.current?.version ?? '0.19.0';
    },
    get capabilities(): IntelligenceCapability[] {
      return deriveCapabilities(sdkRef.current);
    },
    discoverCapabilities(): IntelligenceCapability[] {
      return deriveCapabilities(sdkRef.current);
    },
    get isReady(): boolean {
      return !!sdkRef.current;
    },
    get sdk(): QvacSdkLike | undefined {
      return sdkRef.current;
    },
    activeRequests,
    upstreamRequestIds,

    async invoke<T = unknown>(op: IntelligenceOperation<T>): Promise<IntelligenceOutcome<T>> {
      const requestId = op.requestId ?? nextRequestId();
      log('debug', `invoke ${op.domain}:${op.op}`, { requestId });
      return callAsOp<T>(op as IntelligenceOperation<T>, requestId);
    },

    async *invokeStream(op: IntelligenceStreamOperation): AsyncIterable<IntelligenceStreamChunk> {
      if (!STREAM_CAPABLE_OPS.has(op.op)) {
        throw new IntelligenceError(
          'NOT_IMPLEMENTED',
          `Streaming operation '${op.op}' is not supported by this provider.`,
        );
      }

      const requestId = op.requestId ?? nextRequestId();
      if (typeof op.onChunk === 'function' && op.onChunk.length === 0) {
        throw new IntelligenceError('INVALID_REQUEST', 'onChunk must accept at least one argument');
      }

      const controller = new AbortController();
      activeRequests.set(requestId, controller);
      log('debug', `stream ${op.domain}:${op.op} start`, { requestId });
      try {
        await resolveSdk();
        const handler = resolveOp(op.domain, op.op);
        if (!handler) {
          throw new IntelligenceError(
            'NOT_IMPLEMENTED',
            `Streaming operation '${op.op}' (domain '${op.domain}') is not implemented.`,
          );
        }
        const bridge: { upstream?: string } = {};
        const result = await handler(op.params, { signal: controller.signal, requestIdBridge: bridge });
        if (result.upstreamRequestId || bridge.upstream) {
          upstreamRequestIds.set(requestId, result.upstreamRequestId ?? bridge.upstream as string);
        }

        const source = extractStreamSource(result.data);
        if (!source) {
          throw new IntelligenceError(
            'NOT_IMPLEMENTED',
            `Operation '${op.op}' did not return a supported stream surface (events, bufferStream, progressStream, blockStream, or an async iterable).`,
          );
        }

        const emit = (chunk: IntelligenceStreamChunk): void => {
          if (typeof op.onChunk === 'function') {
            op.onChunk(chunk as never);
          }
        };

        for await (const item of source.iterable) {
          if (source.kind === 'completion-events' && isCompletionDoneEvent(item)) {
            // We emit our own final done chunk (with usage) below.
            continue;
          }
          if (source.kind === 'block-stream' && Array.isArray(item)) {
            // OCR blockStream yields batches of blocks; surface each block.
            for (const block of item) {
              const chunk = streamChunkFrom(op, block);
              emit(chunk);
              yield chunk;
            }
            continue;
          }
          const chunk = streamChunkFrom(op, item);
          emit(chunk);
          yield chunk;
        }

        let usage: IntelligenceUsage | undefined;
        if (
          source.kind === 'completion-events'
          && source.final
          && typeof (source.final as Promise<unknown>).then === 'function'
        ) {
          try {
            const fin = await (source.final as Promise<{ stats?: unknown }>);
            usage = extractor(op.domain, op.op, { stats: fin?.stats ?? undefined }) as IntelligenceUsage | undefined;
          } catch {
            usage = undefined;
          }
        } else {
          usage = extractor(op.domain, op.op, result.data) as IntelligenceUsage | undefined;
        }

        const finalChunk: IntelligenceStreamChunk = { type: 'done', usage };
        emit(finalChunk);
        yield finalChunk;
      } catch (err) {
        throw asIntelligenceError(err);
      } finally {
        activeRequests.delete(requestId);
        upstreamRequestIds.delete(requestId);
      }
    },

    async cancel(requestId: string): Promise<IntelligenceOutcome<void>> {
      const controller = activeRequests.get(requestId);
      if (!controller) {
        return {
          ok: false,
          requestId,
          code: 'NOT_FOUND',
          message: 'No registered in-flight request with that id.',
          retryable: false,
        } as const;
      }

      const upstreamRequestId = upstreamRequestIds.get(requestId);
      controller.abort();

      const sdk = sdkRef.current;
      if (upstreamRequestId && sdk && typeof sdk.cancel === 'function') {
        try {
          await (sdk.cancel as (p: { requestId: string }) => Promise<unknown>)({ requestId: upstreamRequestId });
        } catch {
          // Best-effort: the local abort has already settled the in-flight call.
        }
      }

      upstreamRequestIds.delete(requestId);
      return { ok: true, requestId, data: undefined } as const;
    },

    async close(): Promise<void> {
      for (const controller of activeRequests.values()) {
        controller.abort();
      }
      activeRequests.clear();
      upstreamRequestIds.clear();
      const sdk = sdkRef.current;
      if (sdk && typeof sdk.close === 'function') {
        await sdk.close();
      }
      log('debug', 'provider closed');
    },
  };

  return provider;
}

function defaultOpResolver(
  sdkRef: { current?: QvacSdkLike },
  extractor: QvacUsageExtractor,
): (domain: string, op: string) => QvacOpHandler | undefined {
  return (domain: string, op: string) => {
    const shape = qvacOpShape(op);
    const handler = wrapCallable(sdkRef.current?.[op], extractor, shape, op);
    if (!handler) {
      logAbsent(domain, op);
      return undefined;
    }
    return handler;
  };
}

/**
 * Capability discovery from the resolved SDK surface.
 *
 * While no SDK is resolved the provider advertises the full canonical domain
 * set. Once `sdk` is present (injected, loaded via `sdkLoader`, or lazily
 * required), capabilities reflect which domains actually have at least one
 * callable operation on the SDK — so a QVAC runtime without the RAG plugin
 * stops advertising `intelligence:rag`.
 */
function deriveCapabilities(sdk?: QvacSdkLike): IntelligenceCapability[] {
  if (!sdk) {
    return INTELLIGENCE_CAPABILITIES.slice();
  }
  const live: IntelligenceDomain[] = [];
  for (const domain of INTELLIGENCE_DOMAINS) {
    const ops = INTELLIGENCE_OPS[domain];
    if (ops.some(op => typeof sdk[op] === 'function')) {
      live.push(domain);
    }
  }
  return live.map(d => `intelligence:${d}`) as unknown as IntelligenceCapability[];
}

/**
 * Lazy, optional load of the upstream `@qvac/sdk` package. Returns null when
 * the package is not installed (or when running in an ESM-only context where
 * `require` is unavailable), so the provider can fall back to a clear
 * UNAVAILABLE error instead of crashing at import time.
 */
function tryRequireQvacSdk(): QvacSdkLike | null {
  if (typeof require !== 'function') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const mod = require('@qvac/sdk') as { default?: QvacSdkLike } & QvacSdkLike;
    return mod?.default ?? mod;
  } catch {
    return null;
  }
}

function logAbsent(_domain: string, _op: string): void {
  // no-op: absence is surfaced through NOT_IMPLEMENTED on invoke.
}

function extractIterable(value: unknown): AsyncIterable<unknown> | Iterable<unknown> | undefined {
  if (value === null || value === undefined) return undefined;
  if (isAsyncIterable(value) || isIterable(value)) return value;
  return undefined;
}

function isAsyncIterable(v: unknown): v is AsyncIterable<unknown> {
  return typeof v === 'object' && v !== null && typeof (v as { [Symbol.asyncIterator]?: unknown })[Symbol.asyncIterator] === 'function';
}

function isCompletionDoneEvent(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return false;
  return (value as { type?: unknown }).type === 'completionDone';
}

function isIterable(v: unknown): v is Iterable<unknown> {
  return typeof v === 'object' && v !== null && typeof (v as { [Symbol.iterator]?: unknown })[Symbol.iterator] === 'function';
}

/**
 * Kinds of iterable surfaces the real @qvac/sdk exposes for its streaming
 * operations. `extractStreamSource` maps an op result to one of these:
 *
 *  - iterable            — a bare async/sync iterable (loggingStream,
 *                          transcribeStream, invokePluginStream, and the
 *                          textToSpeechStream/bciTranscribeStream sessions).
 *  - completion-events   — CompletionRun.events (+ .final for usage).
 *  - buffer-stream       — TextToSpeechStreamResult.bufferStream (audio).
 *  - progress-stream     — diffusion/upscale/audioGen/video results.
 *  - block-stream        — OCR result.blockStream (yields arrays of blocks).
 */
type QvacStreamSource =
  | { kind: 'iterable'; iterable: AsyncIterable<unknown> | Iterable<unknown> }
  | { kind: 'completion-events'; iterable: AsyncIterable<unknown> | Iterable<unknown>; final?: unknown }
  | { kind: 'buffer-stream'; iterable: AsyncIterable<unknown> | Iterable<unknown> }
  | { kind: 'progress-stream'; iterable: AsyncIterable<unknown> | Iterable<unknown> }
  | { kind: 'block-stream'; iterable: AsyncIterable<unknown> | Iterable<unknown> };

function extractStreamSource(value: unknown): QvacStreamSource | undefined {
  if (value === null || value === undefined) return undefined;

  if (isAsyncIterable(value) || isIterable(value)) {
    return { kind: 'iterable', iterable: value };
  }
  if (typeof value !== 'object') return undefined;

  const o = value as Record<string, unknown>;
  if (isAsyncIterable(o.events) || isIterable(o.events)) {
    return { kind: 'completion-events', iterable: o.events, final: o.final };
  }
  if (isAsyncIterable(o.bufferStream) || isIterable(o.bufferStream)) {
    return { kind: 'buffer-stream', iterable: o.bufferStream };
  }
  if (isAsyncIterable(o.progressStream) || isIterable(o.progressStream)) {
    return { kind: 'progress-stream', iterable: o.progressStream };
  }
  if (isAsyncIterable(o.blockStream) || isIterable(o.blockStream)) {
    return { kind: 'block-stream', iterable: o.blockStream };
  }
  return undefined;
}

function streamChunkFrom(
  op: IntelligenceStreamOperation,
  item: unknown,
): IntelligenceStreamChunk {
  // Numeric/typed-array payloads (e.g. TTS bufferStream samples).
  if (typeof item === 'number') return { type: 'audio', data: item as never };
  if (item instanceof Uint8Array) return { type: 'audio', data: item };
  if (item === null || typeof item !== 'object') {
    return { type: 'delta', data: { value: item } };
  }
  const o = item as Record<string, unknown>;

  // Respect an explicit `type` discriminator when present.
  if (typeof o.type === 'string') {
    switch (o.type) {
      case 'token':
        return { type: 'token', text: String(o.text ?? '') };
      case 'contentDelta':
        return { type: 'token', text: String(o.text ?? '') };
      case 'segment':
        return { type: 'segment', text: String(o.text ?? o.segment ?? o.transcript ?? ''), index: typeof o.index === 'number' ? o.index : undefined };
      case 'sentenceChunk':
        return { type: 'segment', text: String(o.sentenceChunk ?? '') };
      case 'ttsStreamChunk':
      case 'audioChunk':
        return typeof o.buffer !== 'undefined'
          ? { type: 'audio', data: o.buffer }
          : { type: 'delta', data: o as Record<string, unknown> };
      case 'audio':
        return { type: 'audio', data: o.data ?? o.audio, mimeType: typeof o.mimeType === 'string' ? o.mimeType : undefined };
      case 'image':
        return { type: 'image', data: o.data ?? o.image, mimeType: typeof o.mimeType === 'string' ? o.mimeType : undefined };
      case 'progress':
        return { type: 'progress', percent: typeof o.percent === 'number' ? o.percent : undefined, message: typeof o.message === 'string' ? o.message : undefined };
      case 'completionStats':
        return { type: 'progress', message: typeof o.stats === 'object' && o.stats !== null ? JSON.stringify(o.stats) : undefined };
      case 'delta':
        return { type: 'delta', data: (o.data ?? o) as Record<string, unknown> };
      case 'rawDelta':
        return { type: 'delta', data: { text: o.text } as Record<string, unknown> };
      case 'thinkingDelta':
        return { type: 'delta', data: { text: o.text } as Record<string, unknown> };
      case 'toolCall':
        return { type: 'delta', data: { toolCall: o.call } as Record<string, unknown> };
      case 'toolError':
        return { type: 'delta', data: { error: o.error } as Record<string, unknown> };
      case 'completionDone':
      case 'done':
        return { type: 'done' };
      default:
        break;
    }
  }

  if (typeof o.text === 'string') return { type: 'token', text: o.text };
  if (typeof o.token === 'string') return { type: 'token', text: o.token };

  // Diffusion/audioGen/video progress ticks react to their live shapes.
  if (typeof o.step === 'number' && typeof o.totalSteps === 'number') {
    const percent = o.totalSteps > 0 ? Math.round((o.step / o.totalSteps) * 100) : undefined;
    return { type: 'progress', percent, message: String(o.step ?? '') };
  }
  if ((typeof o.audioDurationMs === 'number' || typeof o.percent === 'number' || typeof o.progress === 'number') && typeof o.type !== 'string') {
    return {
      type: 'progress',
      percent: typeof o.percent === 'number' ? o.percent : typeof o.progress === 'number' ? o.progress : undefined,
      message: typeof o.audioDurationMs === 'number' ? `audioDurMs:${o.audioDurationMs}` : undefined,
    };
  }

  if (typeof o.segment === 'string') {
    return { type: 'segment', text: o.segment, index: typeof o.index === 'number' ? o.index : undefined };
  }
  if (typeof o.transcript === 'string') {
    return { type: 'segment', text: o.transcript, index: typeof o.index === 'number' ? o.index : undefined };
  }

  if (typeof o.audio !== 'undefined') return { type: 'audio', data: o.audio };
  if (typeof o.image !== 'undefined') return { type: 'image', data: o.image };

  if (typeof o.percent === 'number' || typeof o.progress === 'number') {
    return {
      type: 'progress',
      percent: typeof o.percent === 'number' ? o.percent : typeof o.progress === 'number' ? o.progress : undefined,
    };
  }
  if (typeof o.progressTick === 'object' && o.progressTick !== null) {
    return { type: 'progress', message: JSON.stringify(o.progressTick) };
  }

  return { type: 'delta', data: o as Record<string, unknown> };
}

function asIntelligenceError(err: unknown): IntelligenceError {
  if (err instanceof IntelligenceError) return err;
  const message = err instanceof Error ? err.message : String(err);
  return new IntelligenceError('INTERNAL', message, { cause: err });
}

function makeError<T>(requestId: string, err: unknown): IntelligenceErrorResult {
  const intelligenceErr = asIntelligenceError(err);
  return {
    ok: false,
    requestId,
    code: intelligenceErr.code,
    message: intelligenceErr.message,
    retryable: intelligenceErr.retryable,
  } as const;
}

export type { QvacCallResult, QvacOpHandler, QvacOpShape, QvacProviderOptions, QvacSdkLike, QvacUsageExtractor } from './qvac-sdk.js';
export { QVAC_OP_SHAPES, qvacOpShape } from './qvac-sdk.js';