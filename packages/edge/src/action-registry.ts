/**
 * edge/action-registry.ts — Universal Edge action registry.
 *
 * Every agent-accessible operation is a canonical action with a definition:
 *
 *   resolve action
 *   → check runtime capability
 *   → prepare/simulate
 *   → derive actual effects
 *   → evaluate mandate and local bounds
 *   → reserve usage
 *   → execute through private port
 *   → commit or abort
 *
 * `prepare` builds the real operation (the wallet builds/simulates the tx
 * first). `deriveEffects` extracts the SECURITY FACTS from that prepared
 * operation — never from agent-supplied hints. `execute` runs the prepared
 * operation through the private port.
 *
 * Some activities are ungrantable: the agent can never receive direct access
 * to seed export, private keys, raw signing, key-lease reserve/commit/burn,
 * policy replacement, raw port handles, or identity-root rotation.
 */

import type { EdgeCapability } from './capabilities.js';
import type { EdgeOperationResult } from './types.js';
import type { StepEffects } from '@totemsdk/agent-policy';

export type EdgeActionEffect = 'read' | 'write' | 'sign' | 'spend' | 'publish' | 'admin';

export interface EdgeActionInput {
  action: string;
  subject: string;
  payload?: Record<string, unknown>;
  context?: Record<string, unknown>;
}

export interface EdgeActionDefinition {
  /** Runtime capability the action requires (support check, not authorization). */
  capability: EdgeCapability;
  /** Effect class — used for capability gating and audit. */
  effect: EdgeActionEffect;
  /** Build the real operation from the request (wallet builds/simulates first). */
  prepare(input: EdgeActionInput): unknown | Promise<unknown>;
  /** Extract canonical security facts from the PREPARED operation. */
  deriveEffects(prepared: unknown): StepEffects;
  /** Execute the prepared operation through the private port. */
  execute(prepared: unknown): Promise<EdgeOperationResult>;
}

export interface EdgeActionRegistry {
  register(def: EdgeActionDefinition, action: string | string[]): void;
  resolve(action: string): EdgeActionDefinition | undefined;
  isUngrantable(action: string): boolean;
  listActions(): string[];
}

/**
 * Activities the agent must never invoke directly. Key-lease operations remain
 * internal consequences of an authorized signing action, not agent-callable
 * actions. Identity-root rotation is routed through a dedicated governance flow.
 */
export const UNGRANTABLE_ACTIONS: readonly string[] = [
  'wallet:seed-export',
  'wallet:private-key',
  'wallet:session-seed',
  'signing:raw',
  'keylease:reserve',
  'keylease:commit',
  'keylease:burn',
  'policy:replace',
  'port:raw',
  'identity:root-rotate',
];

export function isUngrantableAction(action: string): boolean {
  return UNGRANTABLE_ACTIONS.some((a) => action === a || action.startsWith(`${a}:`));
}

export function createEdgeActionRegistry(): EdgeActionRegistry {
  const exact = new Map<string, EdgeActionDefinition>();
  const prefixes = new Map<string, EdgeActionDefinition>();

  function register(def: EdgeActionDefinition, action: string | string[]): void {
    const actions = Array.isArray(action) ? action : [action];
    for (const a of actions) {
      if (isUngrantableAction(a)) {
        throw new Error(`action '${a}' is ungrantable and cannot be registered`);
      }
      if (a.endsWith(':*')) {
        prefixes.set(a.slice(0, -1), def);
      } else {
        exact.set(a, def);
      }
    }
  }

  function resolve(action: string): EdgeActionDefinition | undefined {
    const exactDef = exact.get(action);
    if (exactDef) return exactDef;
    for (const [prefix, def] of prefixes) {
      if (action.startsWith(prefix)) return def;
    }
    return undefined;
  }

  return {
    register,
    resolve,
    isUngrantable: isUngrantableAction,
    listActions: () => [...exact.keys(), ...[...prefixes.keys()].map((p) => `${p}*`)],
  };
}
