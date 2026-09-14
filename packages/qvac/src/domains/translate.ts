/**
 * @totemsdk/qvac/translate — Translation domain adapter (translate).
 */

import type { IntelligenceProvider } from '@totemsdk/intelligence';
import { bindDomain } from './adapter.js';
import type { QvacOp } from './adapter.js';

export const translateDomain = 'translate' as const;

export interface TranslateParams {
  text?: string;
  from?: string;
  to?: string;
}

export interface QvacTranslateOps {
  translate: QvacOp<TranslateParams, { text?: string }>;
}

export function translateAdapter(provider: IntelligenceProvider): QvacTranslateOps {
  return {
    translate: bindDomain(provider, translateDomain, 'translate'),
  };
}