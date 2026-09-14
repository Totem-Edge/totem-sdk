/**
 * @totemsdk/qvac/ocr — OCR domain adapter (ocr).
 */

import type { IntelligenceProvider } from '@totemsdk/intelligence';
import { bindDomain } from './adapter.js';
import type { QvacOp } from './adapter.js';

export const ocrDomain = 'ocr' as const;

export interface OcrParams {
  image?: unknown;
  language?: string;
}

export interface QvacOcrOps {
  ocr: QvacOp<OcrParams, { text?: string }>;
}

export function ocrAdapter(provider: IntelligenceProvider): QvacOcrOps {
  return {
    ocr: bindDomain(provider, ocrDomain, 'ocr'),
  };
}