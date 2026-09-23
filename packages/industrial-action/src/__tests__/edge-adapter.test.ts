/**
 * RFC-010 P1 — industrial action definitions on the governed edge runtime.
 *
 * Covers the adapter contract (`toEdgeActionDefinition`): schema validation
 * (the previous empty-schema no-op), guardrail evaluation, commitment +
 * deterministic operation id, effect derivation, and the execution policy
 * (timeout, bounded retry, rollback).
 */

import { toEdgeActionDefinition, runWithPolicy } from '../edge-adapter.js';
import type { IndustrialActionDefinition } from '../edge-adapter.js';
import { executeAction } from '../executor.js';
import { createProposal } from '../proposal.js';
import { ActionValidationError, ActionConditionError } from '../errors.js';
import type { ActionSchema } from '../types.js';

const SCHEMA: ActionSchema = {
  parameters: [
    { name: 'setpoint', type: 'number', required: true },
    { name: 'rampRate', type: 'number', required: false },
  ],
  context: [{ name: 'zoneId', type: 'string', required: true }],
};

function makeDefinition(
  overrides: Partial<IndustrialActionDefinition> = {},
): IndustrialActionDefinition {
  return {
    kind: 'temp.set',
    description: 'Set temperature setpoint',
    schema: SCHEMA,
    capability: 'industrial:action',
    effect: 'write',
    guardrails: [
      { type: 'parameter_range', field: 'setpoint', operator: 'gte', value: 10 },
      { type: 'parameter_range', field: 'setpoint', operator: 'lte', value: 35 },
    ],
    async prepare(params) {
      return { resourceId: 'HVAC-03', command: { setpoint: params.setpoint } };
    },
    deriveEffects: () => ({ spends: [], stateChanges: { deviceWrite: true } }),
    actuate: async () => ({ ok: true, data: { applied: true } }),
    ...overrides,
  };
}

const INPUT = {
  action: 'industrial:temp.set',
  subject: 'HVAC-03',
  payload: { setpoint: 22.5, rampRate: 1.0 },
  context: { zoneId: 'HVAC-03' },
};

describe('toEdgeActionDefinition (RFC-010 P1)', () => {
  it('maps capability and effect through to the edge definition', () => {
    const edgeDef = toEdgeActionDefinition(makeDefinition());
    expect(edgeDef.capability).toBe('industrial:action');
    expect(edgeDef.effect).toBe('write');
  });

  it('validates parameters against the real schema (no empty-schema no-op)', async () => {
    const edgeDef = toEdgeActionDefinition(makeDefinition());
    await expect(edgeDef.prepare({ ...INPUT, payload: { rampRate: 1.0 } })).rejects.toBeInstanceOf(
      ActionValidationError,
    );
  });

  it('rejects a parameter of the wrong type', async () => {
    const edgeDef = toEdgeActionDefinition(makeDefinition());
    await expect(
      edgeDef.prepare({ ...INPUT, payload: { setpoint: 'hot' } }),
    ).rejects.toBeInstanceOf(ActionValidationError);
  });

  it('validates required context', async () => {
    const edgeDef = toEdgeActionDefinition(makeDefinition());
    await expect(edgeDef.prepare({ ...INPUT, context: {} })).rejects.toBeInstanceOf(
      ActionValidationError,
    );
  });

  it('enforces guardrails before building the operation', async () => {
    const edgeDef = toEdgeActionDefinition(makeDefinition());
    await expect(
      edgeDef.prepare({ ...INPUT, payload: { setpoint: 50 } }),
    ).rejects.toBeInstanceOf(ActionConditionError);
  });

  it('produces a commitment and a deterministic operation id', async () => {
    const edgeDef = toEdgeActionDefinition(makeDefinition());
    const a = await edgeDef.prepare(INPUT);
    const b = await edgeDef.prepare(INPUT);
    expect(a.commitmentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.operationId).toBe(b.operationId);

    const other = await edgeDef.prepare({ ...INPUT, payload: { setpoint: 23 } });
    expect(other.operationId).not.toBe(a.operationId);
  });

  it('derives effects from the prepared operation', async () => {
    const edgeDef = toEdgeActionDefinition(makeDefinition());
    const prepared = await edgeDef.prepare(INPUT);
    expect(edgeDef.deriveEffects(prepared)).toEqual({
      spends: [],
      stateChanges: { deviceWrite: true },
    });
  });

  it('executes a successful actuation', async () => {
    const edgeDef = toEdgeActionDefinition(makeDefinition());
    const prepared = await edgeDef.prepare(INPUT);
    await expect(edgeDef.execute(prepared)).resolves.toMatchObject({ ok: true });
  });
});

describe('execution policy (RFC-010 P1)', () => {
  const prepared = async (): Promise<import('../edge-adapter.js').PreparedDeviceOp> => {
    const edgeDef = toEdgeActionDefinition(makeDefinition());
    return (await edgeDef.prepare(INPUT)) as import('../edge-adapter.js').PreparedDeviceOp;
  };

  it('maps a failed actuation result', async () => {
    const def = makeDefinition({
      actuate: async () => ({ ok: false, error: 'device refused', errorCode: 'EXECUTION_FAILED' }),
    });
    const result = await runWithPolicy(def, await prepared());
    expect(result).toMatchObject({ ok: false, errorCode: 'EXECUTION_FAILED' });
  });

  it('times out a hung actuation and never reports success', async () => {
    const def = makeDefinition({
      policy: { timeoutMs: 15 },
      actuate: () => new Promise(() => {}),
    });
    const result = await runWithPolicy(def, await prepared());
    expect(result).toMatchObject({ ok: false, errorCode: 'EXECUTION_TIMEOUT' });
  });

  it('retries a retryable failure up to maxAttempts', async () => {
    const actuate = jest.fn().mockResolvedValue({
      ok: false,
      error: 'timed out',
      errorCode: 'EXECUTION_TIMEOUT',
    });
    const def = makeDefinition({ policy: { maxAttempts: 3, timeoutMs: 0 }, actuate });
    const result = await runWithPolicy(def, await prepared());
    expect(actuate).toHaveBeenCalledTimes(3);
    expect(result.ok).toBe(false);
  });

  it('does not retry a non-retryable failure', async () => {
    const actuate = jest.fn().mockResolvedValue({
      ok: false,
      error: 'permanent',
      errorCode: 'EXECUTION_FAILED',
    });
    const def = makeDefinition({ policy: { maxAttempts: 3 }, actuate });
    await runWithPolicy(def, await prepared());
    expect(actuate).toHaveBeenCalledTimes(1);
  });

  it('runs the rollback hook on terminal failure', async () => {
    const rollback = jest.fn().mockResolvedValue(undefined);
    const def = makeDefinition({
      policy: { rollback },
      actuate: async () => ({ ok: false, error: 'boom', errorCode: 'EXECUTION_FAILED' }),
    });
    await runWithPolicy(def, await prepared());
    expect(rollback).toHaveBeenCalledTimes(1);
  });
});

describe('executeAction schema validation (RFC-010 P1 fix)', () => {
  it('rejects params that violate the executor schema', async () => {
    const proposal = createProposal({
      kind: 'temp.set',
      parameters: { setpoint: 22.5 },
      context: { zoneId: 'HVAC-03' },
    });
    await expect(
      executeAction(
        proposal,
        {
          kind: 'temp.set',
          schema: SCHEMA,
          execute: async () => ({ ok: true }),
        },
        { zoneId: 'HVAC-03' },
      ),
    ).resolves.toMatchObject({ execution: { status: 'confirmed' } });

    const bad = createProposal({
      kind: 'temp.set',
      parameters: { rampRate: 1 },
      context: { zoneId: 'HVAC-03' },
    });
    await expect(
      executeAction(
        bad,
        { kind: 'temp.set', schema: SCHEMA, execute: async () => ({ ok: true }) },
        { zoneId: 'HVAC-03' },
      ),
    ).rejects.toBeInstanceOf(ActionValidationError);
  });
});
