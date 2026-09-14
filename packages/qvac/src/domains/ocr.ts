/**
 * @totemsdk/qvac/ocr — OCR domain adapter (ocr).
 *
 * The real `@qvac/sdk` `ocr` returns a handle whose `blockStream` yields
 * batches of OCRTextBlock; the provider surfaces each block through
 * `invokeStream`.
 */

import type { IntelligenceProvider } from '@totemsdk/intelligence';
import { bindDomain } from './adapter.js';
import type { QvacOp } from './adapter.js';

import type { OCRClientParams, OCRStats, OCRTextBlock } from '@qvac/sdk';

export const ocrDomain = 'ocr' as const;

export type { OCRClientParams, OCRStats, OCRTextBlock } from '@qvac/sdk';

export interface OcrResult {
  blockStream: AsyncGenerator<OCRTextBlock[]>;
  blocks: Promise<OCRTextBlock[]>;
  stats: Promise<OCRStats | undefined>;
}

export interface QvacOcrOps {
  ocr: QvacOp<OCRClientParams, OcrResult>;
}

export function ocrAdapter(provider: IntelligenceProvider): QvacOcrOps {
  return {
    ocr: bindDomain(provider, ocrDomain, 'ocr'),
  };
}