/**
 * @module @totemsdk/decision/laya
 *
 * Laya adapter. No Python/MLX/CoreML/weights live in the TS package — the client
 * is injected structurally. Laya's `noul` probability vocabulary is translated
 * at this boundary and never escapes (RFC-012 §31.1).
 *
 * Totem `choice→choice`, `score→score`, `probability→noul`, `action→operation
 * choice + one target choice question per target-bearing operation`.
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

/** Structural Laya client seam (implemented by the host, not shipped here). */
export type LayaClientLike = DecisionClientLike;
export type LayaQuestion = DecisionClientQuestion;
export type LayaPrediction = DecisionClientPrediction;

export interface LayaDecisionProviderOptions {
  readonly client: LayaClientLike;
  readonly model?: string;
  readonly runtime?: { readonly id?: string; readonly version?: string };
  readonly id?: string;
  readonly displayName?: string;
  readonly version?: string;
  readonly capabilities?: readonly DecisionCapability[];
  readonly isReady?: boolean;
  readonly info?: DecisionProviderInfo;
}

/** Create a provider-neutral decision provider backed by a Laya client. */
export function createLayaDecisionProvider(
  options: LayaDecisionProviderOptions,
): DecisionProvider {
  return createClientDecisionProvider({
    client: options.client,
    id: options.id ?? 'laya',
    displayName: options.displayName ?? 'Laya',
    version: options.version ?? '0.0.0',
    ...(options.model ? { model: options.model } : {}),
    probabilityType: 'noul',
    probabilityField: 'noul',
    ...(options.capabilities ? { capabilities: options.capabilities } : {}),
    ...(options.isReady !== undefined ? { isReady: options.isReady } : {}),
    info: {
      locality: 'local',
      ...(options.runtime ? { runtime: options.runtime } : {}),
      ...(options.info ?? {}),
    },
  });
}
