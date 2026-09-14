/**
 * @totemsdk/qvac/embed — Embedding domain adapter (embed).
 *
 * Result type mirrors the real `@qvac/sdk@0.19.0` `embed` overloads:
 * single string → `{ embedding: number[] }`, string[] → `{ embedding: number[][] }`.
 */

import type { IntelligenceProvider } from '@totemsdk/intelligence';
import { bindDomain } from './adapter.js';
import type { QvacOp } from './adapter.js';

import type { EmbedStats } from '@qvac/sdk';

export const embedDomain = 'embed' as const;

export interface EmbedParams {
  modelId: string;
  text: string | string[];
}

export interface EmbedResult {
  embedding: number[] | number[][];
  stats?: EmbedStats;
}

export type { EmbedStats } from '@qvac/sdk';

export interface QvacEmbedOps {
  embed: QvacOp<EmbedParams, EmbedResult>;
}

export function embedAdapter(provider: IntelligenceProvider): QvacEmbedOps {
  return {
    embed: bindDomain(provider, embedDomain, 'embed'),
  };
}