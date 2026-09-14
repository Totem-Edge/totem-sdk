/**
 * @totemsdk/qvac/audiogen — Audio generation domain adapter (audioGen).
 */

import type { IntelligenceProvider } from '@totemsdk/intelligence';
import { bindDomain } from './adapter.js';
import type { QvacOp } from './adapter.js';

import type { AudioGenClientParams, AudioGenResult } from '@qvac/sdk';

export const audiogenDomain = 'audiogen' as const;

export type { AudioGenClientParams, AudioGenResult } from '@qvac/sdk';

export interface QvacAudiogenOps {
  audioGen: QvacOp<AudioGenClientParams, AudioGenResult>;
}

export function audiogenAdapter(provider: IntelligenceProvider): QvacAudiogenOps {
  return {
    audioGen: bindDomain(provider, audiogenDomain, 'audioGen'),
  };
}