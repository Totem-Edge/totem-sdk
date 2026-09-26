/**
 * @module @totemsdk/decision/jev
 *
 * Jev / System One adapter. The client is injected structurally; no
 * browser-specific imports from `jev-ultrafast`, no credentials read on import,
 * and API keys are explicit options. Live tests are host-gated (RFC-012 §31.2).
 */

import type { DecisionCapability } from '../constants.js';
import type {
  DecisionProvider,
  DecisionProviderInfo,
} from '../types.js';
import {
  createClientDecisionProvider,
  type DecisionClientLike,
  type DecisionClientPrediction,
  type DecisionClientQuestion,
} from '../typed-backend.js';

/** Structural Jev client seam (implemented by the host, not shipped here). */
export type JevClientLike = DecisionClientLike;
export type JevQuestion = DecisionClientQuestion;
export type JevPrediction = DecisionClientPrediction;

export interface JevDecisionProviderOptions {
  readonly client: JevClientLike;
  readonly model?: string;
  readonly runtime?: { readonly id?: string; readonly version?: string };
  readonly id?: string;
  readonly displayName?: string;
  readonly version?: string;
  readonly capabilities?: readonly DecisionCapability[];
  readonly isReady?: boolean;
  readonly info?: DecisionProviderInfo;
}

/** Create a provider-neutral decision provider backed by a Jev client. */
export function createJevDecisionProvider(
  options: JevDecisionProviderOptions,
): DecisionProvider {
  return createClientDecisionProvider({
    client: options.client,
    id: options.id ?? 'jev',
    displayName: options.displayName ?? 'Jev',
    version: options.version ?? '0.0.0',
    ...(options.model ? { model: options.model } : {}),
    probabilityType: 'probability',
    probabilityField: 'probability',
    ...(options.capabilities ? { capabilities: options.capabilities } : {}),
    ...(options.isReady !== undefined ? { isReady: options.isReady } : {}),
    info: {
      locality: 'unknown',
      ...(options.runtime ? { runtime: options.runtime } : {}),
      ...(options.info ?? {}),
    },
  });
}
