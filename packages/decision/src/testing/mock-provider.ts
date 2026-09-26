/**
 * @module @totemsdk/decision/testing
 *
 * Structural test doubles. Offline only — no network, no models, no credentials.
 */

import type { DecisionCapability } from '../constants.js';
import type {
  DecisionConfidence,
  DecisionProvider,
  DecisionProviderInfo,
  DecisionProviderOutcome,
  DecisionProviderRequest,
  DecisionResult,
} from '../types.js';

export interface MockDecisionProviderOptions {
  readonly id?: string;
  readonly displayName?: string;
  readonly version?: string;
  readonly capabilities?: readonly DecisionCapability[];
  readonly isReady?: boolean;
  readonly info?: DecisionProviderInfo;
  /** Full control over the provider outcome. */
  readonly decide?: (
    request: DecisionProviderRequest,
  ) => DecisionProviderOutcome | Promise<DecisionProviderOutcome>;
  readonly cancel?: (
    requestId: string,
  ) => DecisionProviderOutcome<void> | Promise<DecisionProviderOutcome<void>>;
  readonly close?: () => void | Promise<void>;
  /** Convenience: a fixed decision returned for every request. */
  readonly decision?: DecisionResult;
  readonly confidence?: DecisionConfidence;
}

/**
 * Create a scriptable provider double. When `decide` is omitted the provider
 * returns `decision` (if given) or an `UNAVAILABLE` failure.
 */
export function createMockDecisionProvider(
  options: MockDecisionProviderOptions = {},
): DecisionProvider {
  const provider: DecisionProvider = {
    id: options.id ?? 'mock',
    displayName: options.displayName ?? 'Mock Decision Provider',
    version: options.version ?? '0.0.0',
    capabilities: options.capabilities ?? [
      'decision:choice',
      'decision:score',
      'decision:probability',
      'decision:action',
    ],
    isReady: options.isReady ?? true,
    ...(options.info ? { info: options.info } : {}),

    async decide(request: DecisionProviderRequest): Promise<DecisionProviderOutcome> {
      if (options.decide) return options.decide(request);
      if (options.decision) {
        return {
          ok: true,
          requestId: request.requestId,
          decision: options.decision,
          ...(options.confidence ? { confidence: options.confidence } : {}),
        };
      }
      return {
        ok: false,
        requestId: request.requestId,
        code: 'UNAVAILABLE',
        message: 'Mock provider has no decision configured.',
        retryable: true,
      };
    },

    async cancel(requestId: string): Promise<DecisionProviderOutcome<void>> {
      if (options.cancel) return options.cancel(requestId);
      return { ok: true, requestId };
    },
  };

  if (options.close) {
    return { ...provider, close: async () => options.close?.() };
  }
  return provider;
}
