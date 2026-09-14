/**
 * @totemsdk/qvac/classify — Classification domain adapter (classify).
 */

import type { IntelligenceProvider } from '@totemsdk/intelligence';
import { bindDomain } from './adapter.js';
import type { QvacOp } from './adapter.js';

export const classifyDomain = 'classify' as const;

export interface ClassifyParams {
  input?: unknown;
  labels?: string[];
}

export interface QvacClassifyOps {
  classify: QvacOp<ClassifyParams, { label?: string; confidence?: number }>;
}

export function classifyAdapter(provider: IntelligenceProvider): QvacClassifyOps {
  return {
    classify: bindDomain(provider, classifyDomain, 'classify'),
  };
}