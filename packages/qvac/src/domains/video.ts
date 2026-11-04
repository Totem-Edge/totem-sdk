/**
 * @totemsdk/qvac/video — Video generation domain adapter (video).
 */

import type { IntelligenceProvider } from '@totemsdk/intelligence';
import { bindDomain } from './adapter.js';
import type { QvacOp } from './adapter.js';

import type { VideoClientParams, VideoProgressTick, VideoResult } from '../vendor/qvac-sdk.js';

export type { VideoClientParams, VideoProgressTick, VideoResult } from '../vendor/qvac-sdk.js';

export const videoDomain = 'video' as const;

export interface QvacVideoOps {
  video: QvacOp<VideoClientParams, VideoResult>;
}

export function videoAdapter(provider: IntelligenceProvider): QvacVideoOps {
  return {
    video: bindDomain(provider, videoDomain, 'video'),
  };
}