/**
 * @totemsdk/qvac/tts — Text-to-speech domain adapter (speech + stream).
 *
 * `textToSpeech` returns the genuine `TextToSpeechStreamResult` (async
 * `bufferStream` of PCM samples + `done`), and `textToSpeechStream` returns a
 * duplex session (write/end/destroy + async iterator). The provider surfaces
 * `bufferStream` through `invokeStream`.
 */

import type { IntelligenceProvider } from '@totemsdk/intelligence';
import { bindDomain } from './adapter.js';
import type { QvacOp } from './adapter.js';

import type {
  TextToSpeechStreamClientParams,
  TextToSpeechStreamResult,
  TextToSpeechStreamSession,
  TtsClientParamsInput,
  TtsSentenceChunkUpdate,
} from '@qvac/sdk';

export const ttsDomain = 'tts' as const;

export type {
  TextToSpeechStreamClientParams,
  TextToSpeechStreamResult,
  TextToSpeechStreamResponse,
  TextToSpeechStreamSession,
  TtsClientParamsInput,
  TtsPace,
  TtsSentenceChunkUpdate,
} from '@qvac/sdk';

export interface QvacTtsOps {
  textToSpeech: QvacOp<TtsClientParamsInput, TextToSpeechStreamResult>;
  textToSpeechStream: QvacOp<TextToSpeechStreamClientParams, TextToSpeechStreamSession>;
}

export function ttsAdapter(provider: IntelligenceProvider): QvacTtsOps {
  return {
    textToSpeech: bindDomain(provider, ttsDomain, 'textToSpeech'),
    textToSpeechStream: bindDomain(provider, ttsDomain, 'textToSpeechStream'),
  };
}