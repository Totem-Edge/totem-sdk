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
 * Bind a positional-argument op (see `QvacOpShape.kind === 'positional'`) so
 * the adapter exposes the REAL upstream signature instead of a record:
 * `sdk.vlaPreprocessImage(pixels, width, height, options?)`,
 * `sdk.vlaPadState(state, targetDim?)`,
 * `sdk.modelRegistryGetModel(registryPath, registrySource)`.
 *
 * The args are packed into a `params` record keyed by the op's known argKeys,
 * which the provider unpacks before calling the SDK — so the adapter layer is
 * genuinely upstream-shaped.
 */
export function bindPositional<Args extends readonly unknown[], Result = unknown>(
  provider: IntelligenceProvider,
  domain: string,
  op: string,
  argKeys: readonly string[],
): (...args: Args) => Promise<IntelligenceOutcome<Result>> {
  return (...args) => {
    const params: Record<string, unknown> = {};
    argKeys.forEach((key, index) => {
      params[key] = args[index];
    });
    return provider.invoke<Result>({
      domain: domain as never,
      op,
      params,
    });
  };
}

/**
 * Bind a callback-subscription op (see `QvacOpShape.kind === 'callback'`) so
 * the adapter exposes the REAL upstream signature: the caller passes the
 * handler function and the result carries `{ unsubscribe }`.
 */
export function bindCallback<Handler, Result = { unsubscribe: () => void }>(
  provider: IntelligenceProvider,
  domain: string,
  op: string,
  paramKey: string,
): (handler: Handler) => Promise<IntelligenceOutcome<Result>> {
  return (handler) =>
    provider.invoke<Result>({
      domain: domain as never,
      op,
      params: { [paramKey]: handler },
    });
}

/**
 * A param type that still admits provider-specific / future keys while
 * surfacing the common ones for autocomplete. Composes cleanly with
 * interfaces in each domain module.
 */
export type OpenParams<T> = T & Record<string, unknown>;