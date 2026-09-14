/**
 * Vendored type surface of `@qvac/sdk@0.19.0` — reconstructed faithfully from
 * the real package declarations (see below) so `@totemsdk/qvac` source can
 * typecheck against genuine upstream signatures WITHOUT installing the heavy
 * `@qvac/sdk` runtime (native/bare worker binaries) into this workspace.
 *
 * Provenance / transcription:
 *   - Functional signatures transcribed verbatim from
 *     `@qvac/sdk@0.19.0` `dist/src/client/api/*.d.ts` (npm tarball).
 *   - Structural types transcribed from `@qvac/inference@0.19.1`
 *     `dist/schemas/*.d.ts` (zod-schema-inferred shapes typed out manually).
 *   - This is a curated subset covering exactly the surface the adapter
 *     catalog (QVAC_API_SNAPSHOT) consumes, NOT the entire upstream API.
 *
 * Drift guard: `scripts/verify-qvac-api-drift.mjs` (CI step
 * `validate:qvac-drift`) installs the REAL `@qvac/sdk@0.19.0` in a scratch
 * dir and compares its actual export surface against the snapshot, so a
 * rename/removal upstream fails CI even though the types below age gracefully.
 *
 * This file is a .d.ts INPUT: `tsc` uses it for checking and does not emit it.
 * Consumers who install the real `@qvac/sdk` get the authoritative types from
 * that package itself (the adapters' public param/result types are Totem-native
 * mirrors; `createQvacRawClient` passes the injected module through unchanged).
 */

declare module '@qvac/sdk' {
  /**
   * A promise-like value that carries an upstream requestId synchronously on the
   * promise object itself (real QVAC decorated promises: `loadModel`,
   * `downloadAsset`, `embed`, `transcribe`, `bciTranscribe`, `ragIngest`,
   * `ragSaveEmbeddings`, `ragReindex`, `translate`'s result object, `finetune`).
   */
  export interface RequestIdDecoratedPromise<T> extends Promise<T> {
    readonly requestId: string;
  }

  export type LogLevel = 'error' | 'off' | 'warn' | 'info' | 'debug';
}

declare module '@qvac/sdk' {
  // ---------------------------------------------------------------------------
  // LLM — completion / batchCompletion / finetune
  // ---------------------------------------------------------------------------

  export interface ToolCallWithCall {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
    raw?: string;
    invoke?: () => Promise<unknown>;
  }

  export interface CompletionStats {
    timeToFirstToken?: number;
    tokensPerSecond?: number;
    promptTokensPerSecond?: number;
    cacheTokens?: number;
    promptTokens?: number;
    generatedTokens?: number;
    emittedTokens?: number;
    avgConcurrentSeq?: number;
    backendDevice?: 'gpu' | 'cpu';
  }

  export type StopReason = 'cancelled' | 'eos' | 'length' | 'stopSequence';

  export type ContentDeltaEvent = { type: 'contentDelta'; seq: number; text: string };
  export type RawDeltaEvent = { type: 'rawDelta'; seq: number; text: string };
  export type ThinkingDeltaEvent = { type: 'thinkingDelta'; seq: number; text: string };
  export type ToolCallEvent = {
    type: 'toolCall';
    seq: number;
    call: { id: string; name: string; arguments: Record<string, unknown>; raw?: string };
  };
  export type ToolErrorEvent = {
    type: 'toolError';
    seq: number;
    error: { code: 'PARSE_ERROR' | 'VALIDATION_ERROR' | 'UNKNOWN_TOOL'; message: string; raw?: string };
  };
  export type StatsEvent = { type: 'completionStats'; seq: number; stats: CompletionStats };
  export type DoneEvent =
    | { type: 'completionDone'; seq: number; stopReason: 'error'; error: { message: string }; raw?: { fullText: string } }
    | { type: 'completionDone'; seq: number; stopReason?: StopReason; raw?: { fullText: string } };

  export type CompletionEvent =
    | ContentDeltaEvent
    | RawDeltaEvent
    | ThinkingDeltaEvent
    | ToolCallEvent
    | ToolErrorEvent
    | StatsEvent
    | DoneEvent;

  export interface CompletionFinal {
    contentText: string;
    thinkingText?: string;
    toolCalls: ToolCallWithCall[];
    stats?: CompletionStats;
    stopReason?: StopReason;
    raw: { fullText: string };
    cacheableAssistantContent?: string;
  }

  export interface CompletionRun {
    requestId: string;
    events: AsyncIterable<CompletionEvent>;
    final: Promise<CompletionFinal>;
    tokenStream: AsyncGenerator<string>;
    toolCallStream: AsyncGenerator<ToolCallEvent>;
    text: Promise<string>;
    toolCalls: Promise<ToolCallWithCall[]>;
    stats: Promise<CompletionStats | undefined>;
  }

  export interface CompletionParams {
    modelId: string;
    history: Array<{
      role: string;
      content: string;
      attachments?: unknown[];
    }>;
    stream?: boolean;
    tools?: unknown[];
    mcp?: unknown[];
    toolDialect?: string;
    responseFormat?: unknown;
    kvCache?: boolean | string;
    captureThinking?: boolean;
    emitRawDeltas?: boolean;
    params?: Record<string, unknown>;
  }

  export function completion(params: CompletionParams): CompletionRun;
  export type BatchPrompt = unknown;
  export interface BatchCompletionRun {
    requestId: string;
    events: AsyncIterable<unknown>;
    final: Promise<unknown>;
  }
  export function batchCompletion(params: unknown): BatchCompletionRun;

  export interface FinetuneHandle {
    progressStream: AsyncGenerator<unknown>;
    result: Promise<unknown>;
    requestId: string;
  }
  export function finetune(params: unknown): FinetuneHandle;

  // ---------------------------------------------------------------------------
  // Embedding
  // ---------------------------------------------------------------------------
  export interface EmbedStats {
    [key: string]: unknown;
  }
  export function embed(
    params: { modelId: string; text: string },
    options?: unknown,
  ): RequestIdDecoratedPromise<{ embedding: number[]; stats?: EmbedStats }>;
  export function embed(
    params: { modelId: string; text: string[] },
    options?: unknown,
  ): RequestIdDecoratedPromise<{ embedding: number[][]; stats?: EmbedStats }>;

  // ---------------------------------------------------------------------------
  // RAG
  // ---------------------------------------------------------------------------
  export interface RagDoc {
    id?: string;
    content: string;
    metadata?: unknown;
    embedding?: unknown;
  }
  export interface RagEmbeddedDoc {
    id: string;
    content: string;
    metadata?: unknown;
  }
  export interface RagSearchResult {
    doc: unknown;
    score: number;
    details?: unknown;
  }
  export interface RagWorkspaceInfo {
    id: string;
    name?: string;
    open: boolean;
    documents?: number;
  }
  export interface RagChunkParams {
    content: string;
    chunkSize?: number;
    chunkOverlap?: number;
    chunkStrategy?: string;
    splitStrategy?: string;
    [key: string]: unknown;
  }
  export interface RagIngestParams {
    documents: unknown[];
    embeddingModelId: string;
    workspaceId?: string;
    chunkOpts?: Record<string, unknown>;
    [key: string]: unknown;
  }
  export interface RagSaveEmbeddingsParams {
    chunks: RagEmbeddedDoc[];
    embeddingModelId: string;
    workspaceId?: string;
    [key: string]: unknown;
  }
  export interface RagSearchParams {
    text: string;
    embeddingModelId: string;
    workspaceId?: string;
    topK?: number;
    [key: string]: unknown;
  }
  export interface RagReindexParams {
    workspaceId?: string;
    [key: string]: unknown;
  }
  export interface RagDeleteEmbeddingsParams {
    id?: string | string[];
    workspaceId?: string;
    [key: string]: unknown;
  }
  export interface RagCloseWorkspaceParams {
    workspaceId: string;
    deleteOnClose?: boolean;
  }
  export interface RagDeleteWorkspaceParams {
    workspaceId: string;
  }
  export interface RagSaveEmbeddingsResult {
    id: string;
    status: 'ok' | 'error';
    error?: unknown;
  }
  export interface RagReindexResult {
    reindexed: boolean;
    [key: string]: unknown;
  }

  export function ragChunk(params: RagChunkParams, options?: unknown): Promise<RagDoc[]>;
  export function ragIngest(
    params: RagIngestParams,
    options?: unknown,
  ): RequestIdDecoratedPromise<{ processed: RagSaveEmbeddingsResult[]; droppedIndices: number[] }>;
  export function ragSaveEmbeddings(
    params: RagSaveEmbeddingsParams,
    options?: unknown,
  ): RequestIdDecoratedPromise<RagSaveEmbeddingsResult[]>;
  export function ragSearch(params: RagSearchParams, options?: unknown): Promise<RagSearchResult[]>;
  export function ragDeleteEmbeddings(params: RagDeleteEmbeddingsParams, options?: unknown): Promise<void>;
  export function ragReindex(
    params: RagReindexParams,
    options?: unknown,
  ): RequestIdDecoratedPromise<RagReindexResult>;
  export function ragListWorkspaces(options?: unknown): Promise<RagWorkspaceInfo[]>;
  export function ragCloseWorkspace(params?: RagCloseWorkspaceParams, options?: unknown): Promise<void>;
  export function ragDeleteWorkspace(params: RagDeleteWorkspaceParams, options?: unknown): Promise<void>;

  // ---------------------------------------------------------------------------
  // ASR — transcribe / transcribeStream / bciTranscribe / bciTranscribeStream
  // ---------------------------------------------------------------------------
  export interface TranscribeClientParams {
    modelId: string;
    mode?: string;
    filePath?: string;
    audio?: unknown;
    language?: string;
    [key: string]: unknown;
  }
  export interface TranscribeSegment {
    type: string;
    text: string;
    start?: number;
    end?: number;
    confidence?: number;
    [key: string]: unknown;
  }
  export interface TranscribeStreamSession {
    stats: Promise<unknown>;
    write(audioChunk: Uint8Array): void;
    end(): void;
    destroy(): void;
    [Symbol.asyncIterator](): AsyncIterator<unknown>;
  }
  export interface BciTranscribeClientParams {
    modelId: string;
    mode?: string;
    filePath?: string;
    [key: string]: unknown;
  }
  export interface BciTranscribeStreamSession {
    stats: Promise<unknown>;
    write(audioChunk: Uint8Array): void;
    end(): void;
    destroy(): void;
    [Symbol.asyncIterator](): AsyncIterator<TranscribeSegment | unknown>;
  }

  export function transcribe(
    params: TranscribeClientParams & { metadata?: true },
    options?: unknown,
  ): RequestIdDecoratedPromise<string>;
  export function transcribe(
    params: TranscribeClientParams & { metadata: true },
    options?: unknown,
  ): RequestIdDecoratedPromise<TranscribeSegment[]>;
  export function transcribeStream(
    params: TranscribeClientParams & { metadata?: true },
    options?: unknown,
  ): AsyncGenerator<string>;
  export function transcribeStream(
    params: TranscribeClientParams & { metadata: true },
    options?: unknown,
  ): AsyncGenerator<TranscribeSegment>;
  export function transcribeStream(
    params: unknown,
    options?: unknown,
  ): Promise<TranscribeStreamSession>;
  export function bciTranscribe(
    params: BciTranscribeClientParams & { metadata?: true },
    options?: unknown,
  ): RequestIdDecoratedPromise<string>;
  export function bciTranscribe(
    params: BciTranscribeClientParams & { metadata: true },
    options?: unknown,
  ): RequestIdDecoratedPromise<TranscribeSegment[]>;
  export function bciTranscribeStream(
    params: unknown,
    options?: unknown,
  ): Promise<BciTranscribeStreamSession>;

  // ---------------------------------------------------------------------------
  // Translation
  // ---------------------------------------------------------------------------
  export interface TranslateClientParams {
    text: string | string[];
    from: string;
    to: string;
    modelId?: string;
    stream?: boolean;
    [key: string]: unknown;
  }
  export interface TranslationStats {
    encodeTime?: number;
    decodeTime?: number;
    timeToFirstToken?: number;
    tokensPerSecond?: number;
    totalTime?: number;
    totalTokens?: number;
    cacheTokens?: number;
    [key: string]: unknown;
  }
  export function translate(
    params: TranslateClientParams,
    options?: unknown,
  ): {
    tokenStream: AsyncGenerator<string>;
    stats: Promise<TranslationStats | undefined>;
    translations: Promise<string[]>;
    text: Promise<string>;
    requestId: string;
  };

  // ---------------------------------------------------------------------------
  // TTS — textToSpeech / textToSpeechStream
  // ---------------------------------------------------------------------------
  export interface TtsSentenceChunkUpdate {
    buffer: number[];
    chunkIndex?: number;
    sentenceChunk?: string;
  }
  export interface TtsClientParamsInput {
    modelId: string;
    inputType?: string;
    text: string;
    stream?: boolean;
    sentenceStream?: boolean;
    voice?: string;
    pace?: string;
    language?: string;
    emotion?: string;
    params?: Record<string, unknown>;
    [key: string]: unknown;
  }
  export type TtsPace = 'slow' | 'moderate' | 'fast';
  export interface TextToSpeechStreamResult {
    bufferStream: AsyncGenerator<number>;
    chunkUpdates?: AsyncGenerator<TtsSentenceChunkUpdate>;
    buffer: Promise<number[]>;
    done: Promise<boolean>;
  }
  export interface TextToSpeechStreamResponse {
    type: string;
    buffer?: number[];
    chunkIndex?: number;
    sentenceChunk?: string;
    [key: string]: unknown;
  }
  export interface TextToSpeechStreamClientParams {
    modelId: string;
    inputType?: string;
    stream?: boolean;
    [key: string]: unknown;
  }
  export interface TextToSpeechStreamSession {
    write(textFragment: string | Uint8Array): void;
    end(): void;
    destroy(): void;
    [Symbol.asyncIterator](): AsyncIterator<TextToSpeechStreamResponse>;
  }
  export function textToSpeech(
    params: TtsClientParamsInput,
    options?: unknown,
  ): TextToSpeechStreamResult;
  export function textToSpeechStream(
    params: TextToSpeechStreamClientParams,
    options?: unknown,
  ): Promise<TextToSpeechStreamSession>;

  // ---------------------------------------------------------------------------
  // Diffusion / upscale / audioGen / video / ocr / classify
  // ---------------------------------------------------------------------------
  export interface DiffusionProgressTick {
    step: number;
    totalSteps: number;
    elapsedMs: number;
  }
  export interface DiffusionResult {
    progressStream: AsyncGenerator<DiffusionProgressTick>;
    outputs: Promise<Uint8Array[]>;
    stats: Promise<unknown | undefined>;
  }
  export interface DiffusionClientParams {
    modelId: string;
    prompt: string;
    negativePrompt?: string;
    image?: unknown;
    width?: number;
    height?: number;
    [key: string]: unknown;
  }
  export interface AudioGenResult {
    requestId: string;
    progressStream: AsyncGenerator<unknown>;
    outputs: Promise<Uint8Array[]>;
    stats: Promise<unknown | undefined>;
  }
  export interface AudioGenClientParams {
    modelId: string;
    prompt: string;
    [key: string]: unknown;
  }
  export interface VideoProgressTick {
    step: number;
    totalSteps: number;
    elapsedMs: number;
  }
  export interface VideoResult {
    requestId: string;
    progressStream: AsyncGenerator<VideoProgressTick>;
    outputs: Promise<Uint8Array[]>;
    stats: Promise<unknown | undefined>;
  }
  export interface VideoClientParams {
    modelId: string;
    prompt: string;
    image?: unknown;
    [key: string]: unknown;
  }
  export interface UpscaleClientParams {
    modelId: string;
    image: unknown;
    [key: string]: unknown;
  }
  export interface UpscaleStreamResponse {
    type: string;
    [key: string]: unknown;
  }
  export interface UpscaleStats {
    [key: string]: unknown;
  }
  export interface OCRTextBlock {
    text: string;
    bbox?: unknown;
    confidence?: number;
    [key: string]: unknown;
  }
  export interface OCRClientParams {
    modelId: string;
    image: unknown;
    [key: string]: unknown;
  }
  export interface OCRStats {
    detectionTime?: number;
    recognitionTime?: number;
    totalTime?: number;
    [key: string]: unknown;
  }
  export interface ClassificationResult {
    text: string;
    value?: number;
    [key: string]: unknown;
  }
  export interface ClassifyClientParams {
    modelId: string;
    text: string;
    labels?: string[];
    [key: string]: unknown;
  }

  export function diffusion(params: DiffusionClientParams): DiffusionResult;
  export function upscale(params: UpscaleClientParams): {
    progressStream: AsyncGenerator<DiffusionProgressTick>;
    outputs: Promise<Uint8Array[]>;
    stats: Promise<UpscaleStats | undefined>;
  };
  export function audioGen(params: AudioGenClientParams): AudioGenResult;
  export function video(params: VideoClientParams): VideoResult;
  export function ocr(params: OCRClientParams): {
    blockStream: AsyncGenerator<OCRTextBlock[]>;
    blocks: Promise<OCRTextBlock[]>;
    stats: Promise<OCRStats | undefined>;
  };
  export function classify(params: ClassifyClientParams): Promise<ClassificationResult[]>;

  // ---------------------------------------------------------------------------
  // VLA — vla / vlaHparams / vlaSetEmbodiment / vlaPreprocessImage / vlaPadState
  // ---------------------------------------------------------------------------
  export type VlaEmbodimentSelection =
    | string
    | number
    | { tag: string; catId?: never; numCameras?: number }
    | { catId: number; tag?: never; numCameras?: number };
  export interface VlaHparams {
    chunkSize: number;
    actionDim: number;
    maxActionDim: number;
    maxStateDim: number;
    tokenizerMaxLength: number;
    visionImageSize: number;
    numCameras?: number;
    stateInputMode?: 'discrete' | 'continuous';
    imageInputMode?: 'pixels' | 'patches';
    imagePatchElems?: number;
    selectedEmbodimentTag?: string;
    selectedEmbodimentCatId?: number;
  }
  export interface VlaStats {
    vision_ms?: number;
    prefill_compute_ms?: number;
    prefill_total_ms?: number;
    smollm2_compute_ms?: number;
    smollm2_total_ms?: number;
    ode_ms?: number;
    total_ms?: number;
    backendDevice?: number;
  }
  export interface VlaClientRunParams {
    modelId: string;
    images: string[];
    imgWidth: number;
    imgHeight: number;
    state: string;
    tokens: string;
    mask: string;
    noise?: string;
  }
  export interface VlaClientRunResult {
    actions: string;
    actionDim: number;
    chunkSize: number;
    stats?: VlaStats;
  }
  export function vla(params: VlaClientRunParams): Promise<VlaClientRunResult>;
  export function vlaHparams(params: { modelId: string }): Promise<{
    hparams: VlaHparams;
    backendName: string | null;
  }>;
  export function vlaSetEmbodiment(params: {
    modelId: string;
    embodiment: VlaEmbodimentSelection;
  }): Promise<{ hparams: VlaHparams }>;
  export function vlaPreprocessImage(
    pixels: Float32Array,
    width: number,
    height: number,
    options?: { params?: Record<string, unknown>; [key: string]: unknown },
  ): Promise<Uint8Array>;
  export function vlaPadState(
    state: Uint8Array,
    targetDim?: number,
  ): Promise<Uint8Array>;
  export const VLA_DEFAULT_IMAGE_SIZE: number;

  // ---------------------------------------------------------------------------
  // World — worldCreateScene / worldStep
  // ---------------------------------------------------------------------------
  export interface WorldSceneClientParams {
    modelId: string;
    username?: string;
    [key: string]: unknown;
  }
  export interface WorldStepClientParams {
    modelId: string;
    [key: string]: unknown;
  }
  export interface WorldSceneResult {
    scene?: unknown;
    [key: string]: unknown;
  }
  export interface WorldSceneResultWithPack {
    scene?: unknown;
    pack?: unknown;
    [key: string]: unknown;
  }
  export interface WorldStepResult {
    events?: unknown;
    [key: string]: unknown;
  }
  export interface WorldStepProgressTick {
    step: number;
    totalSteps: number;
    elapsedMs: number;
  }
  export function worldCreateScene(
    params: WorldSceneClientParams & { returnPack?: boolean },
  ): WorldSceneResult | WorldSceneResultWithPack;
  export function worldStep(params: WorldStepClientParams): WorldStepResult;

  // ---------------------------------------------------------------------------
  // Models — loadModel / unloadModel / getModelInfo / getLoadedModelInfo /
  // deleteCache / downloadAsset / assessModelFit / registry / suspend / resume / state
  // ---------------------------------------------------------------------------
  export interface LoadModelOptions {
    modelSrc: string;
    modelType?: string;
    modelConfig?: Record<string, unknown>;
    modelId?: string;
    fallbackSrc?: string;
    requireHttpChecksum?: boolean;
    requireSecureTransport?: boolean;
    onProgress?: (progress: { type: string; percentage: number; downloaded: number; total?: number; [key: string]: unknown }) => void;
    logger?: unknown;
    [key: string]: unknown;
  }
  export interface DownloadAssetOptions {
    assetSrc?: string;
    assetId?: string;
    hyperdriveKey?: string;
    modelFileName?: string;
    modelPath?: string;
    onProgress?: (progress: { type: string; percentage: number; downloaded: number; total?: number; [key: string]: unknown }) => void;
    [key: string]: unknown;
  }
  export interface ModelInfo {
    modelId: string;
    modelType?: string;
    modelName?: string;
    modelPath?: string;
    config?: Record<string, unknown>;
    [key: string]: unknown;
  }
  export interface LoadedModelInfo {
    modelId: string;
    modelType: string;
    modelName?: string;
    config?: Record<string, unknown>;
    [key: string]: unknown;
  }
  export interface GetModelInfoParams {
    modelId?: string;
    modelType?: string;
    [key: string]: unknown;
  }
  export interface GetLoadedModelInfoParams {
    modelId: string;
  }
  export interface AssessModelFitInput {
    modelId: string;
    [key: string]: unknown;
  }
  export interface AssessModelFitResult {
    fits?: boolean;
    reason?: string;
    [key: string]: unknown;
  }
  export interface ModelRegistryEntry {
    name: string;
    displayName?: string;
    engine?: string;
    addon?: string;
    [key: string]: unknown;
  }
  export interface ModelRegistryEntryAddon extends ModelRegistryEntry {}
  export interface ModelRegistrySearchParams {
    filter?: string;
    engine?: string;
    quantization?: string;
    modelType?: string;
    addon?: string;
  }
  export function loadModel(
    options: LoadModelOptions,
    rpcOptions?: unknown,
  ): RequestIdDecoratedPromise<string>;
  export function unloadModel(params: { modelId: string }, options?: unknown): Promise<void>;
  export function getModelInfo(params: GetModelInfoParams): Promise<ModelInfo>;
  export function getLoadedModelInfo(
    params: GetLoadedModelInfoParams,
    options?: unknown,
  ): Promise<LoadedModelInfo>;
  export function deleteCache(
    params: { all: true } | { kvCacheKey: string; modelId?: string },
  ): Promise<{ success: boolean }>;
  export function downloadAsset(
    options: DownloadAssetOptions,
    rpcOptions?: unknown,
  ): RequestIdDecoratedPromise<string>;
  export function assessModelFit(input: AssessModelFitInput): Promise<AssessModelFitResult>;
  export function modelRegistryList(): Promise<ModelRegistryEntry[]>;
  export function modelRegistrySearch(params?: ModelRegistrySearchParams): Promise<ModelRegistryEntry[]>;
  export function modelRegistryGetModel(
    registryPath: string,
    registrySource: string,
  ): Promise<ModelRegistryEntry>;
  export function suspend(): Promise<void>;
  export function resume(): Promise<void>;
  export function state(): Promise<unknown>;

  // ---------------------------------------------------------------------------
  // System — heartbeat / getSystemResources / loggingStream /
  // subscribeServerLogs / cancel / close
  // ---------------------------------------------------------------------------
  export interface HeartbeatResponse {
    [key: string]: unknown;
  }
  export interface SystemResources {
    [key: string]: unknown;
  }
  export interface GetSystemResourcesInput {
    [key: string]: unknown;
  }
  export interface LoggingParams {
    id: string;
  }
  export interface LoggingStreamResponse {
    type: 'loggingStream';
    id: string;
    level: LogLevel;
    namespace: string;
    message: string;
    timestamp: number;
  }
  export function loggingStream(
    params: LoggingParams,
  ): AsyncGenerator<LoggingStreamResponse>;

  export interface ServerLogHandler {
    (log: LoggingStreamResponse): void;
  }
  export function subscribeServerLogs(handler: ServerLogHandler): () => void;

  export type CancelKind =
    | 'completion' | 'batchCompletion' | 'embeddings' | 'transcribe' | 'translate'
    | 'diffusion' | 'world' | 'audiogen' | 'tts' | 'ocr' | 'vla' | 'finetune'
    | 'loadModel' | 'downloadAsset' | 'rag';
  export type CancelClientInput =
    | { requestId: string; clearCache?: boolean }
    | { operation: 'request'; requestId: string; clearCache?: boolean }
    | { modelId: string; kind?: CancelKind }
    | { operation: 'broad'; modelId: string; kind?: CancelKind }
    | { operation: 'inference'; modelId: string }
    | { operation: 'embeddings'; modelId: string };
  export function cancel(params: CancelClientInput): Promise<void>;

  export function close(): Promise<void>;

  // ---------------------------------------------------------------------------
  // Plugins
  // ---------------------------------------------------------------------------
  export interface InvokePluginOptions<TParams = unknown> {
    modelId: string;
    handler: string;
    params: TParams;
  }
  export function invokePlugin<TResponse = unknown, TParams = unknown>(
    options: InvokePluginOptions<TParams>,
    rpcOptions?: unknown,
  ): Promise<TResponse>;
  export function invokePluginStream<TResponse = unknown, TParams = unknown>(
    options: InvokePluginOptions<TParams>,
    rpcOptions?: unknown,
  ): AsyncGenerator<TResponse>;
}