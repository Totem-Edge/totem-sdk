/**
 * QVAC SDK surface snapshot — catches upstream drift.
 *
 * The @totemsdk/qvac adapter maps a canonical operation catalog to the QVAC
 * SDK's function surface. If QVAC removes/renames an op we depend on, this
 * snapshot pinpoints the change. The snapshot is validated against the
 * injected SDK surface at runtime; it is not a hard dependency on @qvac/sdk
 * being installed in this workspace.
 */

export interface QvacApiSnapshot {
  readonly provider: 'qvac';
  readonly version: string;
  readonly ops: readonly {
    readonly op: string;
    readonly domain: string;
    readonly streamCapable: boolean;
    readonly kind: 'function';
  }[];
}

/** Canonical snapshot of the @qvac/sdk@0.19.0 surface we wrap. */
export const QVAC_API_SNAPSHOT: QvacApiSnapshot = {
  provider: 'qvac',
  version: '0.19.0',
  ops: [
    { op: 'completion', domain: 'llm', streamCapable: false, kind: 'function' },
    { op: 'batchCompletion', domain: 'llm', streamCapable: false, kind: 'function' },
    { op: 'finetune', domain: 'llm', streamCapable: false, kind: 'function' },
    { op: 'embed', domain: 'embed', streamCapable: false, kind: 'function' },
    { op: 'ragChunk', domain: 'rag', streamCapable: false, kind: 'function' },
    { op: 'ragIngest', domain: 'rag', streamCapable: false, kind: 'function' },
    { op: 'ragSearch', domain: 'rag', streamCapable: false, kind: 'function' },
    { op: 'ragSaveEmbeddings', domain: 'rag', streamCapable: false, kind: 'function' },
    { op: 'ragDeleteEmbeddings', domain: 'rag', streamCapable: false, kind: 'function' },
    { op: 'ragReindex', domain: 'rag', streamCapable: false, kind: 'function' },
    { op: 'ragListWorkspaces', domain: 'rag', streamCapable: false, kind: 'function' },
    { op: 'ragCloseWorkspace', domain: 'rag', streamCapable: false, kind: 'function' },
    { op: 'ragDeleteWorkspace', domain: 'rag', streamCapable: false, kind: 'function' },
    { op: 'transcribe', domain: 'asr', streamCapable: false, kind: 'function' },
    { op: 'transcribeStream', domain: 'asr', streamCapable: true, kind: 'function' },
    { op: 'bciTranscribe', domain: 'asr', streamCapable: false, kind: 'function' },
    { op: 'bciTranscribeStream', domain: 'asr', streamCapable: true, kind: 'function' },
    { op: 'translate', domain: 'translate', streamCapable: false, kind: 'function' },
    { op: 'textToSpeech', domain: 'tts', streamCapable: false, kind: 'function' },
    { op: 'textToSpeechStream', domain: 'tts', streamCapable: true, kind: 'function' },
    { op: 'diffusion', domain: 'diffusion', streamCapable: false, kind: 'function' },
    { op: 'upscale', domain: 'diffusion', streamCapable: false, kind: 'function' },
    { op: 'ocr', domain: 'ocr', streamCapable: false, kind: 'function' },
    { op: 'classify', domain: 'classify', streamCapable: false, kind: 'function' },
    { op: 'audioGen', domain: 'audiogen', streamCapable: false, kind: 'function' },
    { op: 'video', domain: 'video', streamCapable: false, kind: 'function' },
    { op: 'vla', domain: 'vla', streamCapable: false, kind: 'function' },
    { op: 'vlaHparams', domain: 'vla', streamCapable: false, kind: 'function' },
    { op: 'vlaSetEmbodiment', domain: 'vla', streamCapable: false, kind: 'function' },
    { op: 'vlaPreprocessImage', domain: 'vla', streamCapable: false, kind: 'function' },
    { op: 'vlaPadState', domain: 'vla', streamCapable: false, kind: 'function' },
    { op: 'worldCreateScene', domain: 'world', streamCapable: false, kind: 'function' },
    { op: 'worldStep', domain: 'world', streamCapable: false, kind: 'function' },
    { op: 'loadModel', domain: 'models', streamCapable: false, kind: 'function' },
    { op: 'unloadModel', domain: 'models', streamCapable: false, kind: 'function' },
    { op: 'getModelInfo', domain: 'models', streamCapable: false, kind: 'function' },
    { op: 'getLoadedModelInfo', domain: 'models', streamCapable: false, kind: 'function' },
    { op: 'deleteCache', domain: 'models', streamCapable: false, kind: 'function' },
    { op: 'downloadAsset', domain: 'models', streamCapable: false, kind: 'function' },
    { op: 'assessModelFit', domain: 'models', streamCapable: false, kind: 'function' },
    { op: 'modelRegistryList', domain: 'models', streamCapable: false, kind: 'function' },
    { op: 'modelRegistrySearch', domain: 'models', streamCapable: false, kind: 'function' },
    { op: 'modelRegistryGetModel', domain: 'models', streamCapable: false, kind: 'function' },
    { op: 'suspend', domain: 'models', streamCapable: false, kind: 'function' },
    { op: 'resume', domain: 'models', streamCapable: false, kind: 'function' },
    { op: 'state', domain: 'models', streamCapable: false, kind: 'function' },
    { op: 'heartbeat', domain: 'system', streamCapable: false, kind: 'function' },
    { op: 'getSystemResources', domain: 'system', streamCapable: false, kind: 'function' },
    { op: 'loggingStream', domain: 'system', streamCapable: false, kind: 'function' },
    { op: 'subscribeServerLogs', domain: 'system', streamCapable: false, kind: 'function' },
    { op: 'cancel', domain: 'system', streamCapable: false, kind: 'function' },
    { op: 'close', domain: 'system', streamCapable: false, kind: 'function' },
    { op: 'invokePlugin', domain: 'plugins', streamCapable: false, kind: 'function' },
    { op: 'invokePluginStream', domain: 'plugins', streamCapable: true, kind: 'function' },
  ],
};

export const QVAC_API_OP_COUNT = QVAC_API_SNAPSHOT.ops.length;
export const QVAC_API_STREAM_OPS = QVAC_API_SNAPSHOT.ops.filter(o => o.streamCapable).map(o => o.op);