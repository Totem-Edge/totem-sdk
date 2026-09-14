/**
 * @totemsdk/qvac/vla — Vision-language-action domain adapter.
 *
 * `vla` / `vlaHparams` / `vlaSetEmbodiment` are record ops. `vlaPreprocessImage`
 * and `vlaPadState` are POSITIONAL in the real SDK and are therefore surfaced
 * as explicit wrappers with their genuine signatures (the provider reassembles
 * the call order via `QVAC_OP_SHAPES`).
 */

import type { IntelligenceOutcome, IntelligenceProvider } from '@totemsdk/intelligence';
import { bindDomain, bindPositional } from './adapter.js';
import type { QvacOp } from './adapter.js';

import type { VlaClientRunParams, VlaClientRunResult, VlaEmbodimentSelection, VlaHparams } from '@qvac/sdk';

export const vlaDomain = 'vla' as const;

export type {
  VlaClientRunParams,
  VlaClientRunResult,
  VlaEmbodimentSelection,
  VlaHparams,
  VlaStats,
} from '@qvac/sdk';

export interface VlaHparamsOpResult {
  hparams: VlaHparams;
  backendName: string | null;
}

export interface QvacVlaOps {
  vla: QvacOp<VlaClientRunParams, VlaClientRunResult>;
  vlaHparams: QvacOp<{ modelId: string }, VlaHparamsOpResult>;
  vlaSetEmbodiment: QvacOp<{ modelId: string; embodiment: VlaEmbodimentSelection }, { hparams: VlaHparams }>;
  /**
   * Real upstream signature: positional, returns the preprocessed image.
   */
  vlaPreprocessImage: (
    pixels: Float32Array,
    width: number,
    height: number,
    options?: Record<string, unknown>,
  ) => Promise<IntelligenceOutcome<Uint8Array>>;
  /**
   * Real upstream signature: positional, pads a state tensor.
   */
  vlaPadState: (
    state: Uint8Array,
    targetDim?: number,
  ) => Promise<IntelligenceOutcome<Uint8Array>>;
}

export function vlaAdapter(provider: IntelligenceProvider): QvacVlaOps {
  return {
    vla: bindDomain(provider, vlaDomain, 'vla'),
    vlaHparams: bindDomain(provider, vlaDomain, 'vlaHparams'),
    vlaSetEmbodiment: bindDomain(provider, vlaDomain, 'vlaSetEmbodiment'),
    vlaPreprocessImage: bindPositional<[Float32Array, number, number, Record<string, unknown> | undefined], Uint8Array>(
      provider, vlaDomain, 'vlaPreprocessImage', ['pixels', 'width', 'height', 'options'],
    ),
    vlaPadState: bindPositional<[Uint8Array, number | undefined], Uint8Array>(
      provider, vlaDomain, 'vlaPadState', ['state', 'targetDim'],
    ),
  };
}