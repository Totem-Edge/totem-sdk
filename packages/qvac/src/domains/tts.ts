/**
 * @totemsdk/qvac/tts — Text-to-speech domain adapter (speech + stream).
 */

import type { IntelligenceProvider } from '@totemsdk/intelligence';
import { bindDomain } from './adapter.js';
import type { QvacOp } from './adapter.js';

export const ttsDomain = 'tts' as const;

export interface TextToSpeechParams {
  text?: string;
  voice?: string;
  pace?: string;
}

export interface QvacTtsOps {
  textToSpeech: QvacOp<TextToSpeechParams, { audio?: unknown; mimeType?: string }>;
  textToSpeechStream: QvacOp<TextToSpeechParams, unknown>;
}

export function ttsAdapter(provider: IntelligenceProvider): QvacTtsOps {
  return {
    textToSpeech: bindDomain(provider, ttsDomain, 'textToSpeech'),
    textToSpeechStream: bindDomain(provider, ttsDomain, 'textToSpeechStream'),
  };
}