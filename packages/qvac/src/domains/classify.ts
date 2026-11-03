/**
 * @totemsdk/qvac/classify — Classification domain adapter (classify).
 */

import type { IntelligenceProvider } from '@totemsdk/intelligence';
import { bindDomain } from './adapter.js';
import type { QvacOp } from './adapter.js';

import type { ClassificationResult, ClassifyClientParams } from '../vendor/qvac-sdk.js';

export const classifyDomain = 'classify' as const;

export type { ClassificationResult, ClassifyClientParams } from '../vendor/qvac-sdk.js';

export interface QvacClassifyOps {
  classify: QvacOp<ClassifyClientParams, ClassificationResult[]>;
}

export function classifyAdapter(provider: IntelligenceProvider): QvacClassifyOps {
  return {
    classify: bindDomain(provider, classifyDomain, 'classify'),
  };
}