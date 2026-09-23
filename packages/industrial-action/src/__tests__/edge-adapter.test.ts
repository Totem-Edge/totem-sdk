/**
 * RFC-010 P1 — industrial action definitions on the governed edge runtime.
 *
 * Covers the adapter contract (`toEdgeActionDefinition`): schema validation
 * (the previous empty-schema no-op), guardrail evaluation, commitment +
 * deterministic operation id, effect derivation, and the execution policy
 * (timeout, bounded retry, rollback).
 */

import { toEdgeActionDefinition, runWithPolicy } from '../edge-adapter.js';
import type { IndustrialActionDefinition, PreparedDeviceOp, IndustrialExecutionResult } from '../edge-adapter.js';
import { executeAction } from '../executor.js';
import { createProposal, verifyCommitment } from '../proposal.js';
import { computeAuthorityBindingHash } from '../ids.js';
import { createIndustrialReceipt, verifyIndustrialReceipt } from '../industrial-receipt.js';
import { createDurableDeviceOperationStore } from '../operation-store.js';
import { ActionValidationError, ActionConditionError, ActionDefinitionError } from '../errors.js';
import type { ActionSchema } from '../types.js';
import { MemoryStore } from '@totemsdk/storage';

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
  const { policy, ...rest } = overrides;
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
    policy: { failureMode: 'abort', ...(policy ?? {}) },
    ...rest,
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

describe('failure semantics (RFC-010 P3)', () => {
  const prepared = async (
    def: IndustrialActionDefinition,
  ): Promise<PreparedDeviceOp> =>
    (await toEdgeActionDefinition(def).prepare(INPUT)) as PreparedDeviceOp;

  it('rejects a write action without a failureMode at compile time', () => {
    expect(() =>
      toEdgeActionDefinition(makeDefinition({ policy: { failureMode: undefined } })),
    ).toThrow(ActionDefinitionError);
  });

  it('rejects fail-safe without a safeState', () => {
    expect(() =>
      toEdgeActionDefinition(makeDefinition({ policy: { failureMode: 'fail-safe' } })),
    ).toThrow(ActionDefinitionError);
  });

  it('fail-safe commands the safe state and reports safe-stated', async () => {
    const safeState = jest.fn().mockResolvedValue({ ok: true });
    const def = makeDefinition({
      policy: { failureMode: 'fail-safe' },
      safeState,
      actuate: async () => ({ ok: false, error: 'trip', errorCode: 'EXECUTION_FAILED' }),
    });
    const result = (await runWithPolicy(def, await prepared(def))) as IndustrialExecutionResult;
    expect(result.ok).toBe(false);
    expect(result.outcome).toBe('safe-stated');
    expect(result.safeStateApplied).toBe(true);
    expect(safeState).toHaveBeenCalledTimes(1);
  });

  it('fail-silent suppresses further actuation', async () => {
    const def = makeDefinition({
      policy: { failureMode: 'fail-silent' },
      actuate: async () => ({ ok: false, error: 'x', errorCode: 'EXECUTION_FAILED' }),
    });
    expect((await runWithPolicy(def, await prepared(def))).outcome).toBe('suppressed');
  });

  it('fail-closed reports requires-reset', async () => {
    const def = makeDefinition({
      policy: { failureMode: 'fail-closed' },
      actuate: async () => ({ ok: false, error: 'x', errorCode: 'EXECUTION_FAILED' }),
    });
    expect((await runWithPolicy(def, await prepared(def))).outcome).toBe('requires-reset');
  });

  it('fail-operational uses the fallback path', async () => {
    const fallback = jest.fn().mockResolvedValue({ ok: true, data: { via: 'redundant' } });
    const def = makeDefinition({
      policy: { failureMode: 'fail-operational' },
      fallback,
      actuate: async () => ({ ok: false, error: 'x', errorCode: 'EXECUTION_FAILED' }),
    });
    const result = await runWithPolicy(def, await prepared(def));
    expect(result.outcome).toBe('confirmed');
    expect(fallback).toHaveBeenCalledTimes(1);
  });
});

describe('durable idempotency (RFC-010 P3)', () => {
  it('actuates once and dedups a repeated operation', async () => {
    const actuate = jest.fn().mockResolvedValue({ ok: true, data: { applied: true } });
    const store = createDurableDeviceOperationStore(new MemoryStore(), {
      requireAckMode: 'volatile',
    });
    const edgeDef = toEdgeActionDefinition(makeDefinition({ actuate }), { operationStore: store });
    const prepared = (await edgeDef.prepare(INPUT)) as PreparedDeviceOp;

    const first = (await edgeDef.execute(prepared)) as IndustrialExecutionResult;
    const second = (await edgeDef.execute(prepared)) as IndustrialExecutionResult;

    expect(first.outcome).toBe('confirmed');
    expect(second.deduplicated).toBe(true);
    expect(second.outcome).toBe('confirmed');
    expect(actuate).toHaveBeenCalledTimes(1);
  });

  it('records a fail-safe outcome so a repeat does not re-actuate', async () => {
    const actuate = jest.fn().mockResolvedValue({ ok: false, error: 'x', errorCode: 'EXECUTION_FAILED' });
    const safeState = jest.fn().mockResolvedValue({ ok: true });
    const store = createDurableDeviceOperationStore(new MemoryStore(), {
      requireAckMode: 'volatile',
    });
    const edgeDef = toEdgeActionDefinition(
      makeDefinition({ policy: { failureMode: 'fail-safe' }, safeState, actuate }),
      { operationStore: store },
    );
    const prepared = (await edgeDef.prepare(INPUT)) as PreparedDeviceOp;

    const first = (await edgeDef.execute(prepared)) as IndustrialExecutionResult;
    const second = (await edgeDef.execute(prepared)) as IndustrialExecutionResult;

    expect(first.outcome).toBe('safe-stated');
    expect(second.deduplicated).toBe(true);
    expect(second.outcome).toBe('safe-stated');
    expect(actuate).toHaveBeenCalledTimes(1);
    expect(safeState).toHaveBeenCalledTimes(1);
  });
});

describe('authority-proof binding (RFC-010 P2)', () => {
  it('binds mandateProofId into the commitment and operation id', async () => {
    const edgeDef = toEdgeActionDefinition(makeDefinition());
    const a = (await edgeDef.prepare({ ...INPUT, mandateProofId: 'mandate:1' })) as PreparedDeviceOp;
    const b = (await edgeDef.prepare({ ...INPUT, mandateProofId: 'mandate:2' })) as PreparedDeviceOp;

    expect(a.mandateProofId).toBe('mandate:1');
    expect(a.commitmentHash).not.toBe(b.commitmentHash);
    expect(a.operationId).not.toBe(b.operationId);
  });

  it('proposal commitment covers the mandate proof id', () => {
    const base = { kind: 'temp.set', parameters: { setpoint: 22 }, context: { zoneId: 'z' } };
    const p1 = createProposal({ ...base, mandateProofId: 'm1' });
    const p2 = createProposal({ ...base, mandateProofId: 'm2' });
    expect(p1.commitmentHash).not.toBe(p2.commitmentHash);
    expect(verifyCommitment(p1)).toBe(true);
  });

  it('authority binding hash ties commitment + mandate + decision', () => {
    const h = computeAuthorityBindingHash('commit', 'mandate', 'decision');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(computeAuthorityBindingHash('commit', 'mandate', 'decision')).toBe(h);
    expect(computeAuthorityBindingHash('commit', 'mandate', 'other')).not.toBe(h);
  });
});

describe('industrial receipts (RFC-010 P4)', () => {
  it('creates a verifiable, authority-bound EdgeReceipt for an execution', async () => {
    const edgeDef = toEdgeActionDefinition(makeDefinition());
    const prepared = (await edgeDef.prepare({ ...INPUT, mandateProofId: 'mandate:1' })) as PreparedDeviceOp;
    const result = (await edgeDef.execute(prepared)) as IndustrialExecutionResult;

    expect(result.receipt).toBeDefined();
    expect(result.receipt?.kind).toBe('industrial:action');
    expect(verifyIndustrialReceipt(result.receipt).ok).toBe(true);
  });

  it('detects a tampered receipt payload', async () => {
    const edgeDef = toEdgeActionDefinition(makeDefinition());
    const prepared = (await edgeDef.prepare(INPUT)) as PreparedDeviceOp;
    const result = (await edgeDef.execute(prepared)) as IndustrialExecutionResult;

    const receipt = result.receipt!;
    const tampered = { ...receipt, payload: { ...receipt.payload, outcome: 'failed' } };
    const verified = verifyIndustrialReceipt(tampered);
    expect(verified.ok).toBe(false);
    expect(verified.errorCode).toBe('RECEIPT_TAMPERED');
  });

  it('rejects a non-industrial receipt', () => {
    expect(verifyIndustrialReceipt({ receiptId: 'x', kind: 'other', issuedAt: 1, payload: {} })).toMatchObject({
      ok: false,
      errorCode: 'INVALID_RECEIPT',
    });
  });

  it('binds the mandate proof and decision into the receipt', async () => {
    const edgeDef = toEdgeActionDefinition(makeDefinition());
    const prepared = (await edgeDef.prepare({ ...INPUT, mandateProofId: 'mandate:1' })) as PreparedDeviceOp;
    const result = (await edgeDef.execute(prepared)) as IndustrialExecutionResult;

    const receipt = createIndustrialReceipt(prepared, result, { decisionId: 'decision:9' });
    const payload = receipt.payload as unknown as { mandateProofId?: string; decisionId?: string; authorityBinding: string };
    expect(payload.mandateProofId).toBe('mandate:1');
    expect(payload.decisionId).toBe('decision:9');
    expect(verifyIndustrialReceipt(receipt).ok).toBe(true);
  });
});

describe('temporal deadline (RFC-010 P4)', () => {
  it('rejects preparation after the deadline and allows before it', async () => {
    const edgeDef = toEdgeActionDefinition(makeDefinition(), { now: () => 1000 });
    await expect(edgeDef.prepare({ ...INPUT, deadlineAt: 500 })).rejects.toBeInstanceOf(
      ActionValidationError,
    );
    await expect(edgeDef.prepare({ ...INPUT, deadlineAt: 2000 })).resolves.toBeDefined();
  });
});
