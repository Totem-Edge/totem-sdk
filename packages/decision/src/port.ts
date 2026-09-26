/**
 * @module @totemsdk/decision/port
 *
 * Bind a {@link DecisionRuntime} to an {@link EdgeDecisionPort}.
 *
 * This is the composition seam for edge hosting: the port exposes the runtime's
 * capabilities and translates `DecisionOutcome` into the host-agnostic port
 * result shape. It never imports `@totemsdk/edge`.
 */

import { DECISION_CAPABILITIES, type DecisionCapability } from './constants.js';
import type {
  DecisionPortResult,
  DecisionRuntime,
  EdgeDecisionPort,
} from './types.js';

export interface CreateEdgeDecisionPortOptions {
  /** Stable runtime id. Defaults to `'decision'`. */
  readonly runtimeId?: string;
  /** Advertised capabilities. Defaults to the four canonical capabilities. */
  readonly capabilities?: readonly DecisionCapability[];
}

/**
 * Bind a decision runtime to an edge-compatible port.
 *
 * @example
 *   import { createDecisionRuntime, createEdgeDecisionPort } from '@totemsdk/decision';
 *   const port = createEdgeDecisionPort(createDecisionRuntime({ routes: [...] }));
 */
export function createEdgeDecisionPort(
  runtime: DecisionRuntime,
  options: CreateEdgeDecisionPortOptions = {},
): EdgeDecisionPort {
  const port: EdgeDecisionPort = {
    runtimeId: options.runtimeId ?? 'decision',
    capabilities: options.capabilities ?? DECISION_CAPABILITIES,

    async decide(params): Promise<DecisionPortResult> {
      try {
        const outcome = await runtime.decide(params.request);
        if (outcome.ok) {
          return { ok: true, data: outcome };
        }
        return { ok: false, error: outcome.message, errorCode: outcome.code };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
          errorCode: 'INTERNAL',
        };
      }
    },

    async cancel(requestId: string): Promise<DecisionPortResult> {
      if (!runtime.cancel) {
        return { ok: false, error: 'Runtime does not support cancel.', errorCode: 'NOT_IMPLEMENTED' };
      }
      const result = await runtime.cancel(requestId);
      if (result.ok) return { ok: true };
      return { ok: false, error: result.message, errorCode: result.code };
    },

    async close(): Promise<void> {
      await runtime.close?.();
    },
  };

  return port;
}
