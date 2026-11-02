/**
 * RFC-011 Phase B — interlocks / safe-state + resource locks.
 */

import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { MemoryStore } from '@totemsdk/storage';
import { FileStore } from '@totemsdk/storage/fs';

import { createInterlockRegistry, type Interlock } from '../interlocks.js';
import { createDurableResourceLockManager } from '../locks.js';
import { toEdgeActionDefinition } from '../edge-adapter.js';
import type { IndustrialActionDefinition } from '../edge-adapter.js';
import { ActionInterlockError } from '../errors.js';
import type { ActionSchema } from '../types.js';
import type { ResourceId } from '../resources.js';

const SCHEMA: ActionSchema = {
  parameters: [{ name: 'setpoint', type: 'number', required: true }],
  context: [{ name: 'zoneId', type: 'string', required: true }],
};

function makeDefinition(): IndustrialActionDefinition {
  return {
    kind: 'temp.set',
    description: 'Set temperature setpoint',
    schema: SCHEMA,
    capability: 'industrial:action',
    effect: 'write',
    policy: { failureMode: 'fail-safe' },
    safeState: async () => ({ ok: true }),
    async prepare(params) {
      return { resourceId: 'HVAC-03', command: { setpoint: params.setpoint } };
    },
    deriveEffects: () => ({ spends: [] }),
    actuate: async () => ({ ok: true }),
  };
}

const INPUT = {
  action: 'industrial:temp.set',
  subject: 'HVAC-03',
  payload: { setpoint: 22.5 },
  context: { zoneId: 'HVAC-03' },
};

const AHU03: ResourceId = { site: 'plant-1', area: 'hvac', asset: 'AHU-03' };
const BOILER: ResourceId = { site: 'plant-1', area: 'hvac', asset: 'BOILER-1' };

describe('interlocks (RFC-011 §4.3)', () => {
  it('filters resource-scoped interlocks and evaluates global ones', async () => {
    const registry = createInterlockRegistry();
    const global: Interlock = { id: 'e-stop', kind: 'emergency-stop', evaluate: () => ({ satisfied: true }) };
    const ahuOnly: Interlock = { id: 'ahu-permit', kind: 'permit', resources: [AHU03], evaluate: () => ({ satisfied: false, reason: 'no permit' }) };
    registry.register(global);
    registry.register(ahuOnly);

    expect(registry.forResource(AHU03).map((i) => i.id).sort()).toEqual(['ahu-permit', 'e-stop']);
    expect(registry.forResource(BOILER).map((i) => i.id)).toEqual(['e-stop']);

    const ahuFailures = await registry.evaluate({ parameters: {}, context: {}, now: 1, resourceId: AHU03 });
    expect(ahuFailures).toEqual([{ interlockId: 'ahu-permit', kind: 'permit', reason: 'no permit' }]);
    expect(await registry.evaluate({ parameters: {}, context: {}, now: 1, resourceId: BOILER })).toEqual([]);
  });

  it('rejects duplicate interlock ids', () => {
    const registry = createInterlockRegistry();
    const i: Interlock = { id: 'x', kind: 'precondition', evaluate: () => ({ satisfied: true }) };
    registry.register(i);
    expect(() => registry.register(i)).toThrow(/already registered/);
  });

  it('blocks preparation when an interlock fails', async () => {
    const registry = createInterlockRegistry();
    registry.register({ id: 'permit', kind: 'permit', evaluate: () => ({ satisfied: false, reason: 'no permit' }) });
    const edgeDef = toEdgeActionDefinition(makeDefinition(), { interlocks: registry });
    await expect(edgeDef.prepare(INPUT)).rejects.toBeInstanceOf(ActionInterlockError);
  });

  it('applies resource-scoped interlocks via resolveResourceId', async () => {
    const registry = createInterlockRegistry();
    registry.register({
      id: 'ahu-permit',
      kind: 'permit',
      resources: [AHU03],
      evaluate: () => ({ satisfied: false, reason: 'no permit' }),
    });
    const edgeDef = toEdgeActionDefinition(makeDefinition(), {
      interlocks: registry,
      resolveResourceId: () => BOILER, // action targets a resource the interlock does not guard
    });
    await expect(edgeDef.prepare(INPUT)).resolves.toBeDefined();
  });
});

describe('resource locks (RFC-011 §4.8)', () => {
  it('provides mutual exclusion with re-acquire by the same holder', async () => {
    const locks = createDurableResourceLockManager(new MemoryStore(), {
      requireAckMode: 'volatile',
      now: () => 1000,
    });
    expect((await locks.acquire(AHU03, 'run-1')).acquired).toBe(true);
    expect((await locks.acquire(AHU03, 'run-2')).acquired).toBe(false);
    expect((await locks.acquire(AHU03, 'run-1')).acquired).toBe(true);
    expect(await locks.release(AHU03, 'run-2')).toBe(false);
    expect(await locks.release(AHU03, 'run-1')).toBe(true);
    expect((await locks.acquire(AHU03, 'run-2')).acquired).toBe(true);
  });

  it('expires locks by TTL', async () => {
    let clock = 1000;
    const locks = createDurableResourceLockManager(new MemoryStore(), {
      requireAckMode: 'volatile',
      now: () => clock,
    });
    await locks.acquire(AHU03, 'run-1', { ttlMs: 100 });
    expect(await locks.isLocked(AHU03)).toBeDefined();
    clock = 1050;
    expect(await locks.isLocked(AHU03)).toBeDefined();
    clock = 1200;
    expect(await locks.isLocked(AHU03)).toBeUndefined();
    expect((await locks.acquire(AHU03, 'run-2')).acquired).toBe(true);
  });

  it('admits exactly one holder under concurrent acquisition', async () => {
    const locks = createDurableResourceLockManager(new MemoryStore(), { requireAckMode: 'volatile' });
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => locks.acquire(AHU03, `holder-${i}`)),
    );
    expect(results.filter((r) => r.acquired)).toHaveLength(1);
  });

  it('persists locks across restart', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'totem-insys-locks-'));
    {
      const locks = createDurableResourceLockManager(new FileStore(dir), {});
      await locks.acquire(AHU03, 'run-1');
    }
    {
      const locks = createDurableResourceLockManager(new FileStore(dir), {});
      expect(await locks.isLocked(AHU03)).toBeDefined();
      expect((await locks.acquire(AHU03, 'run-2')).acquired).toBe(false);
    }
  });
});
