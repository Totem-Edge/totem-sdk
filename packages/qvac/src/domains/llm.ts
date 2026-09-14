/**
 * @totemsdk/qvac/llm — LLM domain adapter (completion / batchCompletion / finetune).
 *
 * Params and results are the genuine `@qvac/sdk@0.19.0` shapes (see
 * `src/vendor/qvac-sdk.d.ts`): completion returns a live `CompletionRun`
 * (requestId + `events` + `final`), not a flattened `{ text }`.
 */

import type { IntelligenceProvider } from '@totemsdk/intelligence';
import { bindDomain } from './adapter.js';
import type { QvacOp } from './adapter.js';

import type {
  BatchCompletionRun,
  CompletionParams,
  CompletionRun,
  FinetuneHandle,
} from '@qvac/sdk';

export const llmDomain = 'llm' as const;

export type {
  BatchCompletionRun,
  CompletionParams,
  CompletionRun,
  FinetuneHandle,
  CompletionEvent,
  CompletionFinal,
  CompletionStats,
  StopReason,
} from '@qvac/sdk';

export interface QvacLlmOps {
  completion: QvacOp<CompletionParams, CompletionRun>;
  batchCompletion: QvacOp<Record<string, unknown>, BatchCompletionRun>;
  finetune: QvacOp<Record<string, unknown>, FinetuneHandle>;
}

export function llmAdapter(provider: IntelligenceProvider): QvacLlmOps {
  return {
    completion: bindDomain(provider, llmDomain, 'completion'),
    batchCompletion: bindDomain(provider, llmDomain, 'batchCompletion'),
    finetune: bindDomain(provider, llmDomain, 'finetune'),
  };
}