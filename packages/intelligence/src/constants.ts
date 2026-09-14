/**
 * @module @totemsdk/intelligence/constants
 *
 * Version, capability strings, and domain / operation discriminators.
 */

export const INTELLIGENCE_VERSION = '0.1.0';

/**
 * Intelligence domains — mirrors @qvac/sdk plugin categories.
 * Each domain maps to a family of operations.
 */
export type IntelligenceDomain =
  | 'llm'
  | 'embed'
  | 'rag'
  | 'asr'
  | 'translate'
  | 'tts'
  | 'diffusion'
  | 'ocr'
  | 'classify'
  | 'audiogen'
  | 'video'
  | 'vla'
  | 'world'
  | 'models'
  | 'system'
  | 'plugins';

/** All valid intelligence domain literals. */
export const INTELLIGENCE_DOMAINS: readonly IntelligenceDomain[] = [
  'llm',
  'embed',
  'rag',
  'asr',
  'translate',
  'tts',
  'diffusion',
  'ocr',
  'classify',
  'audiogen',
  'video',
  'vla',
  'world',
  'models',
  'system',
  'plugins',
] as const;

/**
 * Edge capability strings for intelligence domains.
 * Follows the edge `domain:action` convention.
 */
export type IntelligenceCapability = `intelligence:${IntelligenceDomain}`;

export const INTELLIGENCE_CAPABILITIES: readonly IntelligenceCapability[] =
  INTELLIGENCE_DOMAINS.map(d => `intelligence:${d}`) as unknown as readonly IntelligenceCapability[];

/**
 * Well-known operation identifiers per domain.
 * Callers may use any string — these are the canonical set shipped by @totemsdk/qvac.
 */
export const INTELLIGENCE_OPS = {
  llm:         ['completion', 'batchCompletion', 'finetune'] as const,
  embed:       ['embed'] as const,
  rag:         ['ragChunk', 'ragIngest', 'ragSearch', 'ragSaveEmbeddings', 'ragDeleteEmbeddings',
                'ragReindex', 'ragListWorkspaces', 'ragCloseWorkspace', 'ragDeleteWorkspace'] as const,
  asr:         ['transcribe', 'transcribeStream', 'bciTranscribe', 'bciTranscribeStream'] as const,
  translate:   ['translate'] as const,
  tts:         ['textToSpeech', 'textToSpeechStream'] as const,
  diffusion:   ['diffusion', 'upscale'] as const,
  ocr:         ['ocr'] as const,
  classify:    ['classify'] as const,
  audiogen:    ['audioGen'] as const,
  video:       ['video'] as const,
  vla:         ['vla', 'vlaHparams', 'vlaSetEmbodiment', 'vlaPreprocessImage', 'vlaPadState'] as const,
  world:       ['worldCreateScene', 'worldStep'] as const,
  models:      ['loadModel', 'unloadModel', 'getModelInfo', 'getLoadedModelInfo',
                'deleteCache', 'downloadAsset', 'assessModelFit',
                'modelRegistryList', 'modelRegistrySearch', 'modelRegistryGetModel',
                'suspend', 'resume', 'state'] as const,
  system:      ['heartbeat', 'getSystemResources', 'loggingStream', 'subscribeServerLogs',
                'cancel', 'close'] as const,
  plugins:     ['invokePlugin', 'invokePluginStream'] as const,
} as const;

/**
 * Union of all well-known operation names.
 */
export type IntelligenceOp =
  | typeof INTELLIGENCE_OPS[keyof typeof INTELLIGENCE_OPS][number];
