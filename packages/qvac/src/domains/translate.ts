/**
 * @totemsdk/qvac/translate — Translation domain adapter (translate).
 *
 * The real `@qvac/sdk` `translate` returns a live handle with an async
 * `tokenStream`, promise `translations`/`text`, and a synchronous requestId
 * the provider forwards on `cancel({ requestId })`.
 */

import type { IntelligenceProvider } from '@totemsdk/intelligence';
import { bindDomain } from './adapter.js';
import type { QvacOp } from './adapter.js';

import type { TranslateClientParams, TranslationStats } from '@qvac/sdk';

export const translateDomain = 'translate' as const;

export type { TranslateClientParams, TranslationStats } from '@qvac/sdk';

export interface TranslateResult {
  tokenStream: AsyncGenerator<string>;
  stats: Promise<TranslationStats | undefined>;
  translations: Promise<string[]>;
  text: Promise<string>;
  requestId: string;
}

export interface QvacTranslateOps {
  translate: QvacOp<TranslateClientParams, TranslateResult>;
}

export function translateAdapter(provider: IntelligenceProvider): QvacTranslateOps {
  return {
    translate: bindDomain(provider, translateDomain, 'translate'),
  };
}