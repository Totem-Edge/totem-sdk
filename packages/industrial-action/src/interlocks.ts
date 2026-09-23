/**
 * RFC-011 §4.3 — interlocks, permits, and safe-state.
 *
 * Safety is a first-class precondition, evaluated before authorization. An
 * interlock failure blocks actuation (the edge runtime turns the thrown error
 * into `PREPARE_FAILED`/`REQUIRES_HUMAN` semantics) — never a silent bypass.
 */

import type { ResourceId, SafeState } from './resources.js';
import { resourceIdKey } from './resources.js';

export type InterlockKind = 'precondition' | 'mutual-exclusion' | 'permit' | 'emergency-stop';

export interface InterlockContext {
  parameters: Record<string, unknown>;
  context: Record<string, unknown>;
  now: number;
  /** Target resource, when known. */
  resourceId?: ResourceId;
}

export interface InterlockResult {
  satisfied: boolean;
  reason?: string;
}

export interface Interlock {
  id: string;
  kind: InterlockKind;
  /** Resources this interlock guards; omitted/empty = applies to every resource. */
  resources?: ResourceId[];
  /** Fail-safe state to command when this interlock trips. */
  safeState?: SafeState;
  evaluate(ctx: InterlockContext): InterlockResult | Promise<InterlockResult>;
}

export interface InterlockFailure {
  interlockId: string;
  kind: InterlockKind;
  reason: string;
}

export interface InterlockRegistry {
  register(interlock: Interlock): void;
  /** Interlocks that guard a resource (including global ones). */
  forResource(id: ResourceId | undefined): Interlock[];
  list(): Interlock[];
  /** Evaluate all applicable interlocks; returns the failures (empty = all passed). */
  evaluate(ctx: InterlockContext): Promise<InterlockFailure[]>;
}

function appliesTo(interlock: Interlock, id: ResourceId | undefined): boolean {
  if (!interlock.resources || interlock.resources.length === 0) return true;
  if (id === undefined) return false;
  const key = resourceIdKey(id);
  return interlock.resources.some((r) => resourceIdKey(r) === key);
}

export function createInterlockRegistry(): InterlockRegistry {
  const interlocks: Interlock[] = [];

  return {
    register(interlock) {
      if (interlocks.some((i) => i.id === interlock.id)) {
        throw new Error(`interlock '${interlock.id}' is already registered`);
      }
      interlocks.push(interlock);
    },
    forResource: (id) => interlocks.filter((i) => appliesTo(i, id)),
    list: () => [...interlocks],
    async evaluate(ctx) {
      const failures: InterlockFailure[] = [];
      for (const interlock of interlocks) {
        if (!appliesTo(interlock, ctx.resourceId)) continue;
        const result = await interlock.evaluate(ctx);
        if (!result.satisfied) {
          failures.push({
            interlockId: interlock.id,
            kind: interlock.kind,
            reason: result.reason ?? 'interlock not satisfied',
          });
        }
      }
      return failures;
    },
  };
}
