/**
 * @module @totemsdk/intelligence/port
 *
 * Bind a provider-neutral {@link IntelligenceProvider} to an
 * {@link EdgeIntelligencePort}.
 *
 * This is the composition seam for edge hosting: any provider that satisfies
 * the contracts in this package (QVAC, a remote LLM gateway, an embedded model
 * host, …) can be rendered into an edge-compatible port here — so consumers
 * never hand-write the port adapter and providers never depend on edge.
 */

import type {
  EdgeIntelligencePort,
  IntelligenceProvider,
  IntelligencePortResult,
} from './types.js';

/**
 * Bind a provider-neutral {@link IntelligenceProvider} to an
 * {@link EdgeIntelligencePort}.
 *
 * The port exposes the provider's `intelligence:*` capability strings and
 * translates provider-neutral operations/results into the port result shape.
 *
 * @example
 *   import { createEdgeIntelligencePort } from '@totemsdk/intelligence';
 *   import { createQvacIntelligenceProvider } from '@totemsdk/qvac';
 *
 *   const port = createEdgeIntelligencePort(
 *     createQvacIntelligenceProvider({ sdk }),
 *   );
 */
export function createEdgeIntelligencePort(
  provider: IntelligenceProvider,
): EdgeIntelligencePort {
  const port: EdgeIntelligencePort = {
    providerId: provider.id,
    capabilities: [...provider.capabilities],

    async invoke(params): Promise<IntelligencePortResult<{ data: unknown; usage?: Record<string, unknown>; receipt?: unknown }>> {
      const signal = params.signal;
      if (signal?.aborted) {
        return { ok: false, errorCode: 'CANCELLED', error: 'Operation cancelled.' };
      }

      const result = await provider.invoke({
        requestId: params.requestId,
        domain: params.domain as never,
        op: params.op,
        params: params.params,
        context: (params.context ?? {}) as never,
        signal,
      });

      if (!result.ok) {
        return { ok: false, errorCode: result.code, error: result.message };
      }

      return {
        ok: true,
        data: {
          data: result.data,
          usage: result.usage as unknown as Record<string, unknown> | undefined,
          receipt: result.receipt,
        },
      };
    },

    async cancel(requestId): Promise<IntelligencePortResult> {
      if (!provider.cancel) {
        return { ok: false, errorCode: 'NOT_IMPLEMENTED', error: 'Provider does not support cancel.' };
      }
      const result = await provider.cancel(requestId);
      if (!result.ok) return { ok: false, errorCode: result.code, error: result.message };
      return { ok: true };
    },

    async close() {
      if (!provider.close) return;
      await provider.close();
    },
  };

  return port;
}