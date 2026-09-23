/**
 * RFC-011 Phase E — versioning + lifecycle events.
 */

import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { FileStore } from '@totemsdk/storage/fs';

import { toEdgeActionDefinition, type IndustrialActionDefinition, type PreparedDeviceOp } from '../edge-adapter.js';
import { definitionVersion, computeSchemaHash, createVersionedActionRegistry } from '../versioning.js';
import { createMemoryActionEventSink, createDurableActionEventSink } from '../events.js';
import { ActionDefinitionError } from '../errors.js';
import type { ActionSchema } from '../types.js';

const SCHEMA: ActionSchema = {
  parameters: [{ name: 'setpoint', type: 'number', required: true }],
  context: [{ name: 'zoneId', type: 'string', required: true }],
};

function makeDefinition(overrides: Partial<IndustrialActionDefinition> = {}): IndustrialActionDefinition {
  const { policy, ...rest } = overrides;
  return {
    kind: 'temp.set',
    description: 'Set temperature setpoint',
    schema: SCHEMA,
    capability: 'industrial:action',
    effect: 'write',
    policy: { failureMode: 'abort', ...(policy ?? {}) },
    async prepare(params) {
      return { resourceId: 'HVAC-03', command: { setpoint: params.setpoint } };
    },
    deriveEffects: () => ({ spends: [] }),
    actuate: async () => ({ ok: true }),
    ...rest,
  };
}

const INPUT = {
  action: 'industrial:temp.set',
  subject: 'HVAC-03',
  payload: { setpoint: 22.5 },
  context: { zoneId: 'HVAC-03' },
};

describe('versioning (RFC-011 §4.5)', () => {
  it('defaults to version 1 and hashes schema structure deterministically', () => {
    expect(definitionVersion({})).toBe(1);
    const a = computeSchemaHash(SCHEMA);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(computeSchemaHash(SCHEMA)).toBe(a);

    const changed: ActionSchema = {
      ...SCHEMA,
      parameters: [{ name: 'setpoint', type: 'number', required: false }],
    };
    expect(computeSchemaHash(changed)).not.toBe(a);
  });

  it('resolves versions and latest, and rejects duplicates', () => {
    const registry = createVersionedActionRegistry();
    registry.register(makeDefinition({ version: 1 }));
    registry.register(makeDefinition({ version: 2 }));

    expect(registry.versions('temp.set')).toEqual([1, 2]);
    expect(definitionVersion(registry.resolve('temp.set')!)).toBe(2);
    expect(definitionVersion(registry.resolve('temp.set', 1)!)).toBe(1);
    expect(registry.resolve('unknown')).toBeUndefined();
    expect(() => registry.register(makeDefinition({ version: 1 }))).toThrow(ActionDefinitionError);
  });

  it('fails closed when the expected version/schema hash does not match', async () => {
    const def = makeDefinition({ version: 3 });
    expect(() => toEdgeActionDefinition(def, { expectedVersion: 2 })).toThrow(/version 3 does not match expected 2/);
    expect(() => toEdgeActionDefinition(def, { expectedSchemaHash: 'deadbeef' })).toThrow(/schema hash/);

    const edgeDef = toEdgeActionDefinition(def, {
      expectedVersion: 3,
      expectedSchemaHash: computeSchemaHash(SCHEMA),
    });
    const prepared = (await edgeDef.prepare(INPUT)) as PreparedDeviceOp;
    expect(prepared.definitionVersion).toBe(3);
    expect(prepared.schemaHash).toBe(computeSchemaHash(SCHEMA));
  });
});

describe('lifecycle events (RFC-011 §4.6)', () => {
  it('emits prepare and execute transitions', async () => {
    const sink = createMemoryActionEventSink();
    const edgeDef = toEdgeActionDefinition(makeDefinition(), { events: sink });
    const prepared = (await edgeDef.prepare(INPUT)) as PreparedDeviceOp;
    await edgeDef.execute(prepared);

    expect(sink.events.map((e) => e.type)).toEqual([
      'validated',
      'guardrails_passed',
      'interlocks_passed',
      'actuation_started',
      'actuation_succeeded',
      'settled',
    ]);
    expect(sink.events[0].detail).toEqual({ kind: 'temp.set' });
  });

  it('emits actuation_failed on a non-confirmed outcome', async () => {
    const sink = createMemoryActionEventSink();
    const edgeDef = toEdgeActionDefinition(
      makeDefinition({ actuate: async () => ({ ok: false, error: 'x', errorCode: 'EXECUTION_FAILED' }) }),
      { events: sink },
    );
    const prepared = (await edgeDef.prepare(INPUT)) as PreparedDeviceOp;
    await edgeDef.execute(prepared);
    expect(sink.events.map((e) => e.type)).toContain('actuation_failed');
    expect(sink.events.find((e) => e.type === 'settled')?.outcome).toBe('aborted');
  });

  it('persists the event stream across restart', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'totem-insys-events-'));
    {
      const sink = createDurableActionEventSink(new FileStore(dir), {});
      const edgeDef = toEdgeActionDefinition(makeDefinition(), { events: sink });
      const prepared = (await edgeDef.prepare(INPUT)) as PreparedDeviceOp;
      await edgeDef.execute(prepared);
    }
    {
      const sink = createDurableActionEventSink(new FileStore(dir), {});
      const events = await sink.list();
      expect(events.map((e) => e.type)).toContain('settled');
      expect(events.length).toBeGreaterThanOrEqual(6);
    }
  });
});
