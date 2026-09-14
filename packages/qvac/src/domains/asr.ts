/**
 * @totemsdk/qvac/asr — Speech recognition domain adapter (transcribe + streams).
 */

import type { IntelligenceProvider } from '@totemsdk/intelligence';
import { bindDomain } from './adapter.js';
import type { QvacOp } from './adapter.js';

export const asrDomain = 'asr' as const;

export interface TranscribeParams {
  audio?: unknown;
  language?: string;
  workspaceName?: string;
}

export interface QvacAsrOps {
  transcribe: QvacOp<TranscribeParams, { transcript?: string }>;
  transcribeStream: QvacOp<TranscribeParams, unknown>;
  bciTranscribe: QvacOp<TranscribeParams, { transcript?: string }>;
  bciTranscribeStream: QvacOp<TranscribeParams, unknown>;
}

export function asrAdapter(provider: IntelligenceProvider): QvacAsrOps {
  return {
    transcribe: bindDomain(provider, asrDomain, 'transcribe'),
    transcribeStream: bindDomain(provider, asrDomain, 'transcribeStream'),
    bciTranscribe: bindDomain(provider, asrDomain, 'bciTranscribe'),
    bciTranscribeStream: bindDomain(provider, asrDomain, 'bciTranscribeStream'),
  };
}