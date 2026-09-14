/**
 * @totemsdk/qvac/audiogen — Audio generation domain adapter (audioGen).
 */

import type { IntelligenceProvider } from '@totemsdk/intelligence';
import { bindDomain } from './adapter.js';
import type { QvacOp } from './adapter.js';

export const audiogenDomain = 'audiogen' as const;

export interface AudioGenParams {
  text?: string;
  engine?: string;
  taskType?: string;
}

export interface QvacAudiogenOps {
  audioGen: QvacOp<AudioGenParams, { audio?: unknown; engine?: string }>;
}

export function audiogenAdapter(provider: IntelligenceProvider): QvacAudiogenOps {
  return {
    audioGen: bindDomain(provider, audiogenDomain, 'audioGen'),
  };
}