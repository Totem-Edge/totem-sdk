/**
 * QVAC SDK surface snapshot — catches upstream drift.
 *
 * The @totemsdk/qvac adapter maps a canonical operation catalog to the QVAC
 * SDK's function surface. If QVAC removes/renames an op we depend on, this
 * snapshot pinpoints the change. The snapshot is validated against the
 * injected SDK surface at runtime and by the CI drift audit
 * (`scripts/verify-qvac-api-drift.mjs`, which installs the REAL @qvac/sdk in a
 * scratch dir); it is not a hard dependency on @qvac/sdk being installed in
 * this workspace.
 *
 * `shape` mirrors {@link QvacOpShape}: `record` (default, receive
 * `(params, opts?)`), `positional` (receive positional args that the provider
 * reassembles from `params` via the op's argKeys), and `callback` (receive a
 * handler function and return a teardown normalised to `{ unsubscribe }`).
 */

export type QvacSnapshotOpShape = 'record' | 'positional' | 'callback';

export interface QvacApiSnapshot {
  readonly provider: 'qvac';
  readonly version: string;
  readonly ops: readonly {
    readonly op: string;
    readonly domain: string;
    readonly streamCapable: boolean;
    readonly kind: 'function';
    readonly shape: QvacSnapshotOpShape;
  }[];
}

/** Canonical snapshot of the @qvac/sdk@0.19.0 surface we wrap. */
export const QVAC_API_SNAPSHOT: QvacApiSnapshot = {
  provider: 'qvac',
  version: '0.19.0',
  ops: [
    { op: 'completion', domain: 'llm', streamCapable: true, kind: 'function', shape: 'record' },
    { op: 'batchCompletion', domain: 'llm', streamCapable: false, kind: 'function', shape: 'record' },
    { op: 'finetune', domain: 'llm', streamCapable: false, kind: 'function', shape: 'record' },
    { op: 'embed', domain: 'embed', streamCapable: false, kind: 'function', shape: 'record' },
    { op: 'ragChunk', domain: 'rag', streamCapable: false, kind: 'function', shape: 'record' },
    { op: 'ragIngest', domain: 'rag', streamCapable: false, kind: 'function', shape: 'record' },
    { op: 'ragSearch', domain: 'rag', streamCapable: false, kind: 'function', shape: 'record' },
    { op: 'ragSaveEmbeddings', domain: 'rag', streamCapable: false, kind: 'function', shape: 'record' },
    { op: 'ragDeleteEmbeddings', domain: 'rag', streamCapable: false, kind: 'function', shape: 'record' },
    { op: 'ragReindex', domain: 'rag', streamCapable: false, kind: 'function', shape: 'record' },
    { op: 'ragListWorkspaces', domain: 'rag', streamCapable: false, kind: 'function', shape: 'record' },
    { op: 'ragCloseWorkspace', domain: 'rag', streamCapable: false, kind: 'function', shape: 'record' },
    { op: 'ragDeleteWorkspace', domain: 'rag', streamCapable: false, kind: 'function', shape: 'record' },
    { op: 'transcribe', domain: 'asr', streamCapable: false, kind: 'function', shape: 'record' },
    { op: 'transcribeStream', domain: 'asr', streamCapable: true, kind: 'function', shape: 'record' },
    { op: 'bciTranscribe', domain: 'asr', streamCapable: false, kind: 'function', shape: 'record' },
    { op: 'bciTranscribeStream', domain: 'asr', streamCapable: true, kind: 'function', shape: 'record' },
    { op: 'translate', domain: 'translate', streamCapable: false, kind: 'function', shape: 'record' },
    { op: 'textToSpeech', domain: 'tts', streamCapable: true, kind: 'function', shape: 'record' },
    { op: 'textToSpeechStream', domain: 'tts', streamCapable: true, kind: 'function', shape: 'record' },
    { op: 'diffusion', domain: 'diffusion', streamCapable: true, kind: 'function', shape: 'record' },
    { op: 'upscale', domain: 'diffusion', streamCapable: true, kind: 'function', shape: 'record' },
    { op: 'ocr', domain: 'ocr', streamCapable: true, kind: 'function', shape: 'record' },
    { op: 'classify', domain: 'classify', streamCapable: false, kind: 'function', shape: 'record' },
    { op: 'audioGen', domain: 'audiogen', streamCapable: true, kind: 'function', shape: 'record' },
    { op: 'video', domain: 'video', streamCapable: true, kind: 'function', shape: 'record' },
    { op: 'vla', domain: 'vla', streamCapable: false, kind: 'function', shape: 'record' },
    { op: 'vlaHparams', domain: 'vla', streamCapable: false, kind: 'function', shape: 'record' },
    { op: 'vlaSetEmbodiment', domain: 'vla', streamCapable: false, kind: 'function', shape: 'record' },
    { op: 'vlaPreprocessImage', domain: 'vla', streamCapable: false, kind: 'function', shape: 'positional' },
    { op: 'vlaPadState', domain: 'vla', streamCapable: false, kind: 'function', shape: 'positional' },
    { op: 'worldCreateScene', domain: 'world', streamCapable: false, kind: 'function', shape: 'record' },
    { op: 'worldStep', domain: 'world', streamCapable: false, kind: 'function', shape: 'record' },
    { op: 'loadModel', domain: 'models', streamCapable: false, kind: 'function', shape: 'record' },
    { op: 'unloadModel', domain: 'models', streamCapable: false, kind: 'function', shape: 'record' },
    { op: 'getModelInfo', domain: 'models', streamCapable: false, kind: 'function', shape: 'record' },
    { op: 'getLoadedModelInfo', domain: 'models', streamCapable: false, kind: 'function', shape: 'record' },
    { op: 'deleteCache', domain: 'models', streamCapable: false, kind: 'function', shape: 'record' },
    { op: 'downloadAsset', domain: 'models', streamCapable: false, kind: 'function', shape: 'record' },
    { op: 'assessModelFit', domain: 'models', streamCapable: false, kind: 'function', shape: 'record' },
    { op: 'modelRegistryList', domain: 'models', streamCapable: false, kind: 'function', shape: 'record' },
    { op: 'modelRegistrySearch', domain: 'models', streamCapable: false, kind: 'function', shape: 'record' },
    { op: 'modelRegistryGetModel', domain: 'models', streamCapable: false, kind: 'function', shape: 'positional' },
    { op: 'suspend', domain: 'models', streamCapable: false, kind: 'function', shape: 'record' },
    { op: 'resume', domain: 'models', streamCapable: false, kind: 'function', shape: 'record' },
    { op: 'state', domain: 'models', streamCapable: false, kind: 'function', shape: 'record' },
    { op: 'heartbeat', domain: 'system', streamCapable: false, kind: 'function', shape: 'record' },
    { op: 'getSystemResources', domain: 'system', streamCapable: false, kind: 'function', shape: 'record' },
    { op: 'loggingStream', domain: 'system', streamCapable: true, kind: 'function', shape: 'record' },
    { op: 'subscribeServerLogs', domain: 'system', streamCapable: false, kind: 'function', shape: 'callback' },
    { op: 'cancel', domain: 'system', streamCapable: false, kind: 'function', shape: 'record' },
    { op: 'close', domain: 'system', streamCapable: false, kind: 'function', shape: 'record' },
    { op: 'invokePlugin', domain: 'plugins', streamCapable: false, kind: 'function', shape: 'record' },
    { op: 'invokePluginStream', domain: 'plugins', streamCapable: true, kind: 'function', shape: 'record' },
  ],
};

export const QVAC_API_OP_COUNT = QVAC_API_SNAPSHOT.ops.length;
export const QVAC_API_STREAM_OPS = QVAC_API_SNAPSHOT.ops.filter(o => o.streamCapable).map(o => o.op);
export const QVAC_API_POSITIONAL_OPS = QVAC_API_SNAPSHOT.ops.filter(o => o.shape === 'positional').map(o => o.op);
export const QVAC_API_CALLBACK_OPS = QVAC_API_SNAPSHOT.ops.filter(o => o.shape === 'callback').map(o => o.op);