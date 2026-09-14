/**
 * @totemsdk/qvac/diffusion — Image generation domain adapter (diffusion / upscale).
 *
 * `diffusion` returns the real `DiffusionResult` (progressStream + `outputs`
 * promise of image bytes). The provider surfaces `progressStream` through
 * `invokeStream`.
 */

import type { IntelligenceProvider } from '@totemsdk/intelligence';
import { bindDomain } from './adapter.js';
import type { QvacOp } from './adapter.js';

import type {
  DiffusionClientParams,
  DiffusionProgressTick,
  DiffusionResult,
  UpscaleClientParams,
} from '@qvac/sdk';

export const diffusionDomain = 'diffusion' as const;

export type {
  DiffusionClientParams,
  DiffusionProgressTick,
  DiffusionResult,
  UpscaleClientParams,
  UpscaleStats,
  UpscaleStreamResponse,
} from '@qvac/sdk';

export interface UpscaleResult {
  progressStream: AsyncGenerator<DiffusionProgressTick>;
  outputs: Promise<Uint8Array[]>;
  stats: Promise<import('@qvac/sdk').UpscaleStats | undefined>;
}

export interface QvacDiffusionOps {
  diffusion: QvacOp<DiffusionClientParams, DiffusionResult>;
  upscale: QvacOp<UpscaleClientParams, UpscaleResult>;
}

export function diffusionAdapter(provider: IntelligenceProvider): QvacDiffusionOps {
  return {
    diffusion: bindDomain(provider, diffusionDomain, 'diffusion'),
    upscale: bindDomain(provider, diffusionDomain, 'upscale'),
  };
}