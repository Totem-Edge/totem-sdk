/**
 * RFC-010 P0/P1 integration — the industrial↔edge seam.
 *
 * Registers an industrial action definition into the REAL
 * `@totemsdk/edge` `EdgeActionRegistry`, checks capability gating, then drives
 * the governed step sequence (resolve → prepare → deriveEffects → execute)
 * against a stub device port, including the industrial execution policy.
 *
 * This is the scaffold for the RFC-010 P6 emulator E2E: the port is the only
 * simulated part; the registry, capability model, schema validation, guardrails,
 * commitment/operation-id derivation, and policy are the production code paths.
 */

import {
  createEdgeActionRegistry,
  isUngrantableAction,
  hasCapability,
  type EdgeCapability,
  type EdgeCapabilitySet,
  type EdgeOperationResult,
} from '@totemsdk/edge';

import { toEdgeActionDefinition } from '../../src/edge-adapter.js';
import type {
  IndustrialActionDefinition,
  ExecutionPolicy,
  PreparedDeviceOp,
} from '../../src/edge-adapter.js';
import type { ActionSchema } from '../../src/types.js';

/** A stub protocol port that records writes and can inject faults. */
class StubDevicePort {
  readonly writes: Array<{ resourceId?: string; command: unknown }> = [];
  fail = false;

  async write(resourceId: string | undefined, command: unknown): Promise<EdgeOperationResult> {
    if (this.fail) {
      return { ok: false, error: 'device fault', errorCode: 'EXECUTION_FAILED' };
    }
    this.writes.push({ resourceId, command });
    return { ok: true, data: { applied: true } };
  }
}

const SCHEMA: ActionSchema = {
  parameters: [{ name: 'setpoint', type: 'number', required: true }],
  context: [{ name: 'zoneId', type: 'string', required: true }],
};

function makeDefinition(
  port: StubDevicePort,
  policy?: ExecutionPolicy,
): IndustrialActionDefinition {
  return {
    kind: 'industrial:temp.set',
    description: 'Set temperature setpoint',
    schema: SCHEMA,
    capability: 'industrial:action',
    effect: 'write',
    guardrails: [{ type: 'parameter_range', field: 'setpoint', operator: 'gte', value: 10 }],
    policy: { failureMode: 'abort', ...(policy ?? {}) },
    async prepare(params) {
      return { resourceId: 'HVAC-03', command: { setpoint: params.setpoint } };
    },
    deriveEffects: (op: PreparedDeviceOp) => ({
      spends: [],
      stateChanges: { resourceId: op.resourceId, setpoint: (op.command as { setpoint: number }).setpoint },
    }),
    actuate: (op) => port.write(op.resourceId, op.command),
  };
}

const INPUT = {
  action: 'industrial:temp.set',
  subject: 'HVAC-03',
  payload: { setpoint: 22.5 },
  context: { zoneId: 'HVAC-03' },
};

describe('industrial action on the edge registry (integration)', () => {
  it('registers and resolves an industrial action; ungrantable kinds are refused', () => {
    const registry = createEdgeActionRegistry();
    const def = makeDefinition(new StubDevicePort());
    registry.register(toEdgeActionDefinition(def), def.kind);

    expect(registry.resolve('industrial:temp.set')).toBeDefined();
    expect(registry.listActions()).toContain('industrial:temp.set');

    expect(() => registry.register(toEdgeActionDefinition(def), 'signing:raw')).toThrow(/ungrantable/);
    expect(isUngrantableAction('keylease:reserve')).toBe(true);
  });

  it('gates on the industrial capability (support, not authorization)', () => {
    const supported: EdgeCapabilitySet = new Set<EdgeCapability>(['industrial:action']);
    const unsupported: EdgeCapabilitySet = new Set<EdgeCapability>(['transport:modbus']);

    expect(hasCapability(supported, 'industrial:action')).toBe(true);
    expect(hasCapability(unsupported, 'industrial:action')).toBe(false);
  });

  it('drives resolve → prepare → deriveEffects → execute against a device port', async () => {
    const port = new StubDevicePort();
    const def = makeDefinition(port);
    const edgeDef = toEdgeActionDefinition(def);
    const registry = createEdgeActionRegistry();
    registry.register(edgeDef, def.kind);

    const resolved = registry.resolve(INPUT.action);
    expect(resolved).toBe(edgeDef);

    const prepared = (await resolved!.prepare(INPUT)) as PreparedDeviceOp;
    expect(prepared.operationId).toMatch(/^totem:ia:op:/);
    expect(resolved!.deriveEffects(prepared)).toMatchObject({
      stateChanges: { resourceId: 'HVAC-03', setpoint: 22.5 },
    });

    const result = await resolved!.execute(prepared);
    expect(result.ok).toBe(true);
    expect(port.writes).toEqual([{ resourceId: 'HVAC-03', command: { setpoint: 22.5 } }]);
  });

  it('applies the execution policy (timeout) across the seam', async () => {
    const port = new StubDevicePort();
    const def = makeDefinition(port, { timeoutMs: 10, maxAttempts: 1 });
    const edgeDef = toEdgeActionDefinition(def);
    const hung = toEdgeActionDefinition({
      ...def,
      actuate: () => new Promise(() => {}),
    });

    const prepared = (await edgeDef.prepare(INPUT)) as PreparedDeviceOp;
    const result = await hung.execute(prepared);
    expect(result).toMatchObject({ ok: false, errorCode: 'EXECUTION_TIMEOUT' });
  });
});
