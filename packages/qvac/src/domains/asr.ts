/**
 * @totemsdk/qvac/asr — Speech recognition domain adapter (transcribe + streams).
 *
 * Result types reflect the real `@qvac/sdk@0.19.0`: `transcribe` resolves to a
 * transcript string (or segments with `metadata: true`), `transcribeStream` is
 * an async generator, and the bci variants resolve sessions.
 */

import type { IntelligenceProvider } from '@totemsdk/intelligence';
import { bindDomain } from './adapter.js';
import type { QvacOp } from './adapter.js';

import type {
  BciTranscribeClientParams,
  BciTranscribeStreamSession,
  TranscribeClientParams,
  TranscribeSegment,
  TranscribeStreamSession,
} from '@qvac/sdk';

export const asrDomain = 'asr' as const;

export type {
  BciTranscribeClientParams,
  BciTranscribeStreamSession,
  TranscribeClientParams,
  TranscribeSegment,
  TranscribeStreamSession,
} from '@qvac/sdk';

export interface QvacAsrOps {
  transcribe: QvacOp<TranscribeClientParams, string>;
  transcribeStream: QvacOp<TranscribeClientParams, TranscribeStreamSession>;
  bciTranscribe: QvacOp<BciTranscribeClientParams, string>;
  bciTranscribeStream: QvacOp<BciTranscribeClientParams, BciTranscribeStreamSession>;
}

export function asrAdapter(provider: IntelligenceProvider): QvacAsrOps {
  return {
    transcribe: bindDomain(provider, asrDomain, 'transcribe'),
    transcribeStream: bindDomain(provider, asrDomain, 'transcribeStream'),
    bciTranscribe: bindDomain(provider, asrDomain, 'bciTranscribe'),
    bciTranscribeStream: bindDomain(provider, asrDomain, 'bciTranscribeStream'),
  };
}