/**
 * @totemsdk/qvac/vla — Vision-language-action domain adapter (vla / hparams / embodiment).
 */

import type { IntelligenceProvider } from '@totemsdk/intelligence';
import { bindDomain } from './adapter.js';
import type { QvacOp } from './adapter.js';

export const vlaDomain = 'vla' as const;

export interface VlaParams {
  image?: unknown;
  instruction?: string;
  embodiment?: unknown;
}

export interface QvacVlaOps {
  vla: QvacOp<VlaParams, { action?: string; confidence?: number }>;
  vlaHparams: QvacOp<Record<string, unknown>, unknown>;
  vlaSetEmbodiment: QvacOp<Record<string, unknown>, unknown>;
  vlaPreprocessImage: QvacOp<Record<string, unknown>, unknown>;
  vlaPadState: QvacOp<Record<string, unknown>, unknown>;
}

export function vlaAdapter(provider: IntelligenceProvider): QvacVlaOps {
  return {
    vla: bindDomain(provider, vlaDomain, 'vla'),
    vlaHparams: bindDomain(provider, vlaDomain, 'vlaHparams'),
    vlaSetEmbodiment: bindDomain(provider, vlaDomain, 'vlaSetEmbodiment'),
    vlaPreprocessImage: bindDomain(provider, vlaDomain, 'vlaPreprocessImage'),
    vlaPadState: bindDomain(provider, vlaDomain, 'vlaPadState'),
  };
}