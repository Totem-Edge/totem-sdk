/** RFC-022 §5.5–5.6 asynchronous operation lifecycle. */

import { MemoryStore } from '@totemsdk/storage';
import {
  toEdgeActionDefinition,
  runWithPolicy,
} from '../edge-adapter.js';
import type {
  IndustrialActionDefinition,
  PreparedDeviceOp,
} from '../edge-adapter.js';
import { createDurableDeviceOperationStore } from '../operation-store.js';
import { createIndustrialOperationLifecycle } from '../operation-lifecycle.js';
import type { ActionSchema } from '../types.js';

const SCHEMA: ActionSchema = {
  parameters: [{ name: 'setpoint', type: 'number', required: true }],
  context: [{ name: 'zoneId', type: 'string', required: true }],
};
const INPUT = {
  action: 'industrial:temp.set',
  subject: 'HVAC-03',
  payload: { setpoint: 22.5 },
  context: { zoneId: 'HVAC-03' },
};

function makeDefinition(overrides: Partial<IndustrialActionDefinition> = {}): IndustrialActionDefinition {
  return {
    kind: 'temp.set',
    description: 'Set temperature setpoint',
    schema: SCHEMA,
    capability: 'industrial:action',
    effect: 'write',
    protocol: 'modbus',
    policy: { failureMode: 'abort' },
    async prepare(params) {
      return { resourceId: 'HVAC-03', command: { setpoint: params.setpoint } };
    },
    deriveEffects: () => ({ spends: [] }),
    actuate: async () => ({ ok: true, data: { handle: 'mission-1' } }),
    ...overrides,
  };
}

function fixture(reconcileStatus: 'confirmed' | 'unknown' = 'confirmed') {
  const store = createDurableDeviceOperationStore(new MemoryStore(), { requireAckMode: 'volatile' });
  const cancel = jest.fn(async () => {});
  const reconcile = jest.fn(async () => reconcileStatus === 'confirmed'
    ? { status: 'confirmed' as const, handle: 'mission-1', result: { completed: true } }
    : { status: 'unknown' as const, handle: 'mission-1', error: 'telemetry unavailable' });
  const def = makeDefinition({ async: { confirmation: 'accepted', reconcile, cancel } });
  const edgeDef = toEdgeActionDefinition(def, { operationStore: store });
  let prepared: PreparedDeviceOp;
  const lifecycle = createIndustrialOperationLifecycle({
    def,
    store,
    resolvePrepared: async (record) => record.operationId === prepared?.operationId ? prepared : undefined,
  });
  return {
    store, def, edgeDef, lifecycle, reconcile, cancel,
    async prepare() {
      prepared = (await edgeDef.prepare(INPUT)) as PreparedDeviceOp;
      return prepared;
    },
  };
}

describe('RFC-022 asynchronous operation lifecycle', () => {
  it('does not close an accepted command as confirmed', async () => {
    const f = fixture();
    const op = await f.prepare();
    const result = await f.edgeDef.execute(op);
    expect(result.ok).toBe(true);
    expect(result.outcome).toBe('accepted');
    expect((await f.store.getOperation(op.operationId))?.status).toBe('accepted');
  });

  it('deduplicates an accepted operation as pending, not success and not a new attempt', async () => {
    const f = fixture();
    const op = await f.prepare();
    await f.edgeDef.execute(op);
    const replay = await f.edgeDef.execute(op);
    expect(replay.ok).toBe(false);
    expect(replay.errorCode).toBe('OPERATION_PENDING');
    expect(replay.outcome).toBe('accepted');
    expect(replay.deduplicated).toBe(true);
    expect(f.reconcile).not.toHaveBeenCalled();
  });

  it('reconciles accepted to confirmed and records progress/result', async () => {
    const f = fixture();
    const op = await f.prepare();
    await f.edgeDef.execute(op);
    const record = await f.lifecycle.reconcile(op.operationId);
    expect(f.reconcile).toHaveBeenCalledWith(op, expect.objectContaining({ status: 'accepted' }));
    expect(record.status).toBe('confirmed');
    expect(record.outcome).toBe('confirmed');
    expect(record.handle).toBe('mission-1');
    expect(record.result).toEqual({ completed: true });
    expect(await f.lifecycle.open()).toEqual([]);
  });

  it('holds unknown reconciliation as reconciling and keeps it open', async () => {
    const f = fixture('unknown');
    const op = await f.prepare();
    await f.edgeDef.execute(op);
    const record = await f.lifecycle.reconcile(op.operationId);
    expect(record.status).toBe('reconciling');
    expect(record.outcome).toBe('unknown');
    expect(record.error).toMatch(/telemetry/);
    expect((await f.lifecycle.open()).map((r) => r.operationId)).toEqual([op.operationId]);
    const replay = await f.edgeDef.execute(op);
    expect(replay.errorCode).toBe('OPERATION_PENDING');
    expect(replay.outcome).toBe('reconciling');
  });

  it('treats cancellation as unresolved until reconciliation', async () => {
    const f = fixture();
    const op = await f.prepare();
    await f.edgeDef.execute(op);
    const cancelled = await f.lifecycle.cancel(op.operationId);
    expect(f.cancel).toHaveBeenCalledWith(op, expect.objectContaining({ status: 'accepted' }));
    expect(cancelled.cancelRequested).toBe(true);
    expect(cancelled.status).toBe('reconciling');
    expect(cancelled.outcome).toBe('unknown');
    const confirmed = await f.lifecycle.reconcile(op.operationId);
    expect(confirmed.status).toBe('confirmed');
    expect(confirmed.cancelRequested).toBe(true);
  });

  it('fails closed when the prepared command cannot be recovered', async () => {
    const f = fixture();
    const op = await f.prepare();
    await f.edgeDef.execute(op);
    const lifecycle = createIndustrialOperationLifecycle({
      def: f.def, store: f.store, resolvePrepared: async () => undefined,
    });
    await expect(lifecycle.reconcile(op.operationId)).rejects.toThrow(/prepared command .* unavailable/);
    expect((await f.store.getOperation(op.operationId))?.status).toBe('accepted');
  });

  it('keeps single-shot confirmation backward compatible', async () => {
    const store = createDurableDeviceOperationStore(new MemoryStore(), { requireAckMode: 'volatile' });
    const def = makeDefinition();
    const edgeDef = toEdgeActionDefinition(def, { operationStore: store });
    const op = (await edgeDef.prepare(INPUT)) as PreparedDeviceOp;
    expect((await edgeDef.execute(op)).outcome).toBe('confirmed');
    expect((await store.getOperation(op.operationId))?.status).toBe('confirmed');
    expect((await runWithPolicy(def, op)).outcome).toBe('confirmed');
  });
});
