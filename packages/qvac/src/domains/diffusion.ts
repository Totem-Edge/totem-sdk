/**
 * @totemsdk/qvac/diffusion — Image generation domain adapter (diffusion / upscale).
 */

import type { IntelligenceProvider } from '@totemsdk/intelligence';
import { bindDomain } from './adapter.js';
import type { QvacOp } from './adapter.js';

export const diffusionDomain = 'diffusion' as const;

export interface DiffusionParams {
  prompt?: string;
  negativePrompt?: string;
  steps?: number;
  width?: number;
  height?: number;
}

export interface DiffusionResult {
  image?: string;
}

export interface UpscaleParams {
  image?: unknown;
  scale?: number;
}

export interface QvacDiffusionOps {
  diffusion: QvacOp<DiffusionParams, DiffusionResult>;
  upscale: QvacOp<UpscaleParams, DiffusionResult>;
}

export function diffusionAdapter(provider: IntelligenceProvider): QvacDiffusionOps {
  return {
    diffusion: bindDomain(provider, diffusionDomain, 'diffusion'),
    upscale: bindDomain(provider, diffusionDomain, 'upscale'),
  };
}