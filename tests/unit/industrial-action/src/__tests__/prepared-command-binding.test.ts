/**
 * RFC-022 P1 — the commitment and approval cover the actual prepared command.
 */

import { MemoryStore } from '@totemsdk/storage';
import {
  toEdgeActionDefinition,
  runWithPolicy,
} from '../edge-adapter.js';
import type {
  IndustrialActionDefinition,
  PreparedDeviceOp,
} from '../edge-adapter.js';
import { computePreparedCommandHash } from '../prepared-command.js';
import { computeCommitmentHash } from '../ids.js';
import { createDurableApprovalRegistry } from '../approvals.js';
import { ActionApprovalError, ActionCommitmentError } from '../errors.js';
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
      return {
        resourceId: 'HVAC-03',
        command: { setpoint: params.setpoint, mode: 'normal' },
      };
    },
    deriveEffects: () => ({ spends: [] }),
    actuate: async () => ({ ok: true }),
    ...overrides,
  };
}

async function prepared(def = makeDefinition()): Promise<PreparedDeviceOp> {
  return (await toEdgeActionDefinition(def).prepare(INPUT)) as PreparedDeviceOp;
}

describe('RFC-022 prepared-command binding', () => {
  it('changes the commitment and operation id when the prepared command changes for identical inputs', async () => {
    const normal = await prepared();
    const changed = await prepared(makeDefinition({
      async prepare(params) {
        return { resourceId: 'HVAC-03', command: { setpoint: params.setpoint, mode: 'economy' } };
      },
    }));
    expect(normal.parameters).toEqual(changed.parameters);
    expect(normal.preparedCommandHash).toMatch(/^[0-9a-f]{64}$/);
    expect(normal.preparedCommandHash).not.toBe(changed.preparedCommandHash);
    expect(normal.commitmentHash).not.toBe(changed.commitmentHash);
    expect(normal.operationId).not.toBe(changed.operationId);
  });

  it('binds the canonical command, resource, protocol, version and schema', async () => {
    const op = await prepared();
    const expected = computePreparedCommandHash({
      resourceId: 'HVAC-03',
      protocol: 'modbus',
      definitionVersion: op.definitionVersion,
      schemaHash: op.schemaHash,
      command: op.command,
    });
    expect(op.preparedCommandHash).toBe(expected);
    expect(op.commitmentHash).toBe(computeCommitmentHash({
      kind: op.kind,
      parameters: op.parameters,
      context: op.context,
      preparedCommandHash: op.preparedCommandHash,
    }));

    const versioned = await prepared(makeDefinition({ version: 2 } as Partial<IndustrialActionDefinition>));
    expect(versioned.preparedCommandHash).not.toBe(op.preparedCommandHash);
  });

  it('uses canonicalizeCommand so logically equal wire forms share a binding', async () => {
    const canonicalize = jest.fn((command: unknown) => {
      const value = command as { setpoint: number };
      return { setpoint: value.setpoint };
    });
    const first = await prepared(makeDefinition({
      async prepare() { return { resourceId: 'HVAC-03', command: { setpoint: 22.5, tags: { b: 2, a: 1 } } }; },
      canonicalizeCommand: canonicalize,
    }));
    const second = await prepared(makeDefinition({
      async prepare() { return { resourceId: 'HVAC-03', command: { setpoint: 22.5, tags: { a: 1, b: 2 } } }; },
      canonicalizeCommand: canonicalize,
    }));
    expect(canonicalize).toHaveBeenCalledTimes(2);
    expect(first.preparedCommandHash).toBe(second.preparedCommandHash);
    expect(first.operationId).toBe(second.operationId);
  });

  it('rejects a mutated prepared command before actuation', async () => {
    const actuate = jest.fn(async () => ({ ok: true }));
    const def = makeDefinition({ actuate });
    const op = await prepared(def);
    (op.command as { setpoint: number }).setpoint = 99;
    await expect(runWithPolicy(def, op)).rejects.toBeInstanceOf(ActionCommitmentError);
    await expect(toEdgeActionDefinition(def).execute(op)).rejects.toBeInstanceOf(ActionCommitmentError);
    expect(actuate).not.toHaveBeenCalled();
  });

  it('binds approval to the prepared command, not just caller inputs', async () => {
    const approvals = createDurableApprovalRegistry(new MemoryStore(), { requireAckMode: 'volatile' });
    const normal = makeDefinition();
    const preview = await prepared(normal);
    const request = await approvals.request({ commitmentHash: preview.commitmentHash });
    await approvals.approve(request.approvalId, 'operator-1');

    await expect(toEdgeActionDefinition(normal, { approvals, requireApproval: true })
      .prepare({ ...INPUT, approvalId: request.approvalId })).resolves.toBeDefined();

    const changed = makeDefinition({
      async prepare(params) {
        return { resourceId: 'HVAC-03', command: { setpoint: params.setpoint, mode: 'economy' } };
      },
    });
    await expect(toEdgeActionDefinition(changed, { approvals, requireApproval: true })
      .prepare({ ...INPUT, approvalId: request.approvalId })).rejects.toBeInstanceOf(ActionApprovalError);
  });
});
