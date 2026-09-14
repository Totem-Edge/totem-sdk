/**
 * @module @totemsdk/qvac/domains
 *
 * Shared machinery for the per-domain @totemsdk/qvac adapters.
 *
 * Each domain adapter is a thin, typed convenience layer over the
 * provider-neutral invoke contract: it binds an op name to a fixed domain and
 * narrows params/results at the boundary. The provider itself (provider.ts)
 * performs dispatch, usage extraction, cancellation, and error mapping.
 */

import type {
  IntelligenceOutcome,
  IntelligenceProvider,
} from '@totemsdk/intelligence';

/** A single typed op callable bound to one provider + domain. */
export type QvacOp<Params = Record<string, unknown>, Result = unknown> = (
  params: Params,
) => Promise<IntelligenceOutcome<Result>>;

/**
 * Bind an op name to a domain for a concrete provider instance.
 *
 * @example
 *   const completion: QvacOp<LlmCompletionParams, LlmCompletionResult> =
 *     bindDomain(provider, 'llm', 'completion');
 */
export function bindDomain<Params, Result = unknown>(
  provider: IntelligenceProvider,
  domain: string,
  op: string,
): QvacOp<Params, Result> {
  return (params) =>
    provider.invoke<Result>({
      domain: domain as never,
      op,
      params: (params ?? {}) as Record<string, unknown>,
    });
}

/**
 * A param type that still admits provider-specific / future keys while
 * surfacing the common ones for autocomplete. Composes cleanly with
 * interfaces in each domain module.
 */
export type OpenParams<T> = T & Record<string, unknown>;