/**
 * @totemsdk/qvac/embed — Embedding domain adapter (embed).
 */

import type { IntelligenceProvider } from '@totemsdk/intelligence';
import { bindDomain } from './adapter.js';
import type { QvacOp } from './adapter.js';

export const embedDomain = 'embed' as const;

export interface EmbedParams {
  text?: string;
  input?: string;
  model?: string;
}

export interface QvacEmbedOps {
  embed: QvacOp<EmbedParams, { vector?: number[] }>;
}

export function embedAdapter(provider: IntelligenceProvider): QvacEmbedOps {
  return {
    embed: bindDomain(provider, embedDomain, 'embed'),
  };
}