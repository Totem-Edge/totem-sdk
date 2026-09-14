/**
 * @totemsdk/qvac/video — Video generation domain adapter (video).
 */

import type { IntelligenceProvider } from '@totemsdk/intelligence';
import { bindDomain } from './adapter.js';
import type { QvacOp } from './adapter.js';

export const videoDomain = 'video' as const;

export interface VideoParams {
  prompt?: string;
  frames?: number;
  width?: number;
  height?: number;
}

export interface QvacVideoOps {
  video: QvacOp<VideoParams, { video?: string; frames?: number }>;
}

export function videoAdapter(provider: IntelligenceProvider): QvacVideoOps {
  return {
    video: bindDomain(provider, videoDomain, 'video'),
  };
}