/**
 * @totemsdk/qvac/llm — LLM domain adapter (completion / batchCompletion / finetune).
 */

import type { IntelligenceProvider } from '@totemsdk/intelligence';
import { bindDomain } from './adapter.js';
import type { QvacOp } from './adapter.js';

export const llmDomain = 'llm' as const;

export interface LlmCompletionParams {
  model?: string;
  prompt?: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LlmCompletionResult {
  text: string;
  model?: string;
}

export interface LlmBatchCompletionParams {
  model?: string;
  prompts?: unknown[];
}

export interface LlmFinetuneParams {
  model?: string;
}

export interface QvacLlmOps {
  completion: QvacOp<LlmCompletionParams, LlmCompletionResult>;
  batchCompletion: QvacOp<LlmBatchCompletionParams, unknown>;
  finetune: QvacOp<LlmFinetuneParams, unknown>;
}

export function llmAdapter(provider: IntelligenceProvider): QvacLlmOps {
  return {
    completion: bindDomain(provider, llmDomain, 'completion'),
    batchCompletion: bindDomain(provider, llmDomain, 'batchCompletion'),
    finetune: bindDomain(provider, llmDomain, 'finetune'),
  };
}