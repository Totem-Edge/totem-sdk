/**
 * RFC-011 Phase F — scheduling (windows / rate limits) + approvals.
 */

import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { MemoryStore } from '@totemsdk/storage';
import { FileStore } from '@totemsdk/storage/fs';

import { toEdgeActionDefinition, type IndustrialActionDefinition } from '../edge-adapter.js';
import { isWithinWindows, createDurableRateLimiter } from '../scheduling.js';
import { createDurableApprovalRegistry } from '../approvals.js';
import { computeCommitmentHash } from '../ids.js';
import { ActionScheduleError, ActionApprovalError } from '../errors.js';
import type { ActionSchema } from '../types.js';

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
    policy: { failureMode: 'abort' },
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

const COMMITMENT = computeCommitmentHash({
  kind: 'temp.set',
  parameters: { setpoint: 22.5 },
  context: { zoneId: 'HVAC-03' },
});

describe('maintenance windows (RFC-011 §4.8)', () => {
  it('evaluates window membership and next open', () => {
    const windows = [{ start: 100, end: 200 }, { start: 500, end: 600 }];
    expect(isWithinWindows(windows, 150)).toEqual({ allowed: true });
    expect(isWithinWindows(windows, 300)).toEqual({ allowed: false, nextOpen: 500 });
    expect(isWithinWindows(windows, 700).allowed).toBe(false);
  });

  it('blocks preparation outside a window', async () => {
    const edgeDef = toEdgeActionDefinition(makeDefinition(), {
      now: () => 300,
      schedule: { windows: [{ start: 100, end: 200 }] },
    });
    await expect(edgeDef.prepare(INPUT)).rejects.toBeInstanceOf(ActionScheduleError);

    const open = toEdgeActionDefinition(makeDefinition(), {
      now: () => 150,
      schedule: { windows: [{ start: 100, end: 200 }] },
    });
    await expect(open.prepare(INPUT)).resolves.toBeDefined();
  });
});

describe('rate limiting (RFC-011 §4.8)', () => {
  it('enforces and resets the limit, and persists', async () => {
    let clock = 1000;
    const limiter = createDurableRateLimiter(new MemoryStore(), {
      requireAckMode: 'volatile',
      now: () => clock,
    });
    const limit = { maxActuations: 2, windowMs: 100 };
    expect((await limiter.consume('r', limit)).allowed).toBe(true);
    expect((await limiter.consume('r', limit)).allowed).toBe(true);
    expect((await limiter.consume('r', limit)).allowed).toBe(false);
    clock = 1200;
    expect((await limiter.consume('r', limit)).allowed).toBe(true);

    const dir = await mkdtemp(join(tmpdir(), 'totem-insys-rl-'));
    {
      const durable = createDurableRateLimiter(new FileStore(dir), { now: () => 1000 });
      await durable.consume('k', limit);
    }
    {
      const durable = createDurableRateLimiter(new FileStore(dir), { now: () => 1000 });
      expect((await durable.peek('k', limit)).remaining).toBe(1);
    }
  });

  it('blocks preparation when the rate limit is exceeded', async () => {
    const rateLimiter = createDurableRateLimiter(new MemoryStore(), {
      requireAckMode: 'volatile',
      now: () => 1000,
    });
    const edgeDef = toEdgeActionDefinition(makeDefinition(), {
      now: () => 1000,
      schedule: { rateLimit: { maxActuations: 1, windowMs: 10_000 } },
      rateLimiter,
    });
    await expect(edgeDef.prepare(INPUT)).resolves.toBeDefined();
    await expect(edgeDef.prepare(INPUT)).rejects.toBeInstanceOf(ActionScheduleError);
  });
});

describe('approvals (RFC-011 §4.9)', () => {
  it('requests, approves/rejects, and validates against the commitment', async () => {
    const approvals = createDurableApprovalRegistry(new MemoryStore(), { requireAckMode: 'volatile' });
    const request = await approvals.request({ commitmentHash: COMMITMENT, reason: 'high risk' });
    expect(request.status).toBe('pending');
    expect(await approvals.validate(request.approvalId, COMMITMENT)).toMatchObject({ valid: false, reason: 'approval is pending' });

    await approvals.approve(request.approvalId, 'operator-1');
    expect(await approvals.validate(request.approvalId, COMMITMENT)).toEqual({ valid: true });
    expect(await approvals.validate(request.approvalId, 'other-commitment')).toMatchObject({
      valid: false,
      reason: 'approval is bound to a different action',
    });

    const second = await approvals.request({ commitmentHash: COMMITMENT });
    await approvals.reject(second.approvalId, 'operator-1', 'not allowed');
    expect(await approvals.validate(second.approvalId, COMMITMENT)).toMatchObject({ valid: false, reason: 'approval is rejected' });
    expect((await approvals.listPending()).length).toBe(0);
  });

  it('enforces approvals in preparation', async () => {
    const approvals = createDurableApprovalRegistry(new MemoryStore(), { requireAckMode: 'volatile' });
    const edgeDef = toEdgeActionDefinition(makeDefinition(), { approvals, requireApproval: true });

    await expect(edgeDef.prepare(INPUT)).rejects.toBeInstanceOf(ActionApprovalError);

    const request = await approvals.request({ commitmentHash: COMMITMENT });
    await expect(edgeDef.prepare({ ...INPUT, approvalId: request.approvalId })).rejects.toBeInstanceOf(ActionApprovalError);

    await approvals.approve(request.approvalId, 'operator-1');
    await expect(edgeDef.prepare({ ...INPUT, approvalId: request.approvalId })).resolves.toBeDefined();
  });
});
