/**
 * RFC-010 P5 — adversarial + crash/restart-under-load coverage.
 *
 * Adversarial: tampered commitments, malformed inputs, hostile authority
 * decisions, receipt tampering, and concurrent replay. Durability: a
 * file-backed operation store survives restart and still dedups actuation.
 */

import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { MemoryStore } from '@totemsdk/storage';
import { FileStore } from '@totemsdk/storage/fs';

import { toEdgeActionDefinition } from '../edge-adapter.js';
import type { IndustrialActionDefinition, PreparedDeviceOp, IndustrialExecutionResult } from '../edge-adapter.js';
import { createDurableDeviceOperationStore } from '../operation-store.js';
import { verifyIndustrialReceipt } from '../industrial-receipt.js';
import { createProposal, verifyCommitment, assertValidProposal } from '../proposal.js';
import { evaluateConditions } from '../condition.js';
import { checkGovernanceConstraints } from '../governance-bridge.js';
import { ActionValidationError, ActionCommitmentError } from '../errors.js';
import type { ActionSchema, ActionProposal } from '../types.js';

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
    async prepare(params) {
      return { resourceId: 'HVAC-03', command: { setpoint: params.setpoint } };
    },
    deriveEffects: () => ({ spends: [] }),
    actuate: async () => ({ ok: true, data: { applied: true } }),
    policy: { failureMode: 'abort', ...(policy ?? {}) },
    ...rest,
  };
}

const INPUT = {
  action: 'industrial:temp.set',
  subject: 'HVAC-03',
  payload: { setpoint: 22.5 },
  context: { zoneId: 'HVAC-03' },
};

describe('adversarial inputs (RFC-010 P5)', () => {
  it('rejects a tampered proposal commitment', () => {
    const proposal = createProposal({
      kind: 'temp.set',
      parameters: { setpoint: 22 },
      context: { zoneId: 'z' },
    });
    const tampered: ActionProposal = { ...proposal, parameters: { setpoint: 99 } };
    expect(verifyCommitment(tampered)).toBe(false);
    expect(() => assertValidProposal(tampered)).toThrow(ActionCommitmentError);
  });

  it('rejects malformed parameters and ignores undeclared fields', async () => {
    const edgeDef = toEdgeActionDefinition(makeDefinition());
    await expect(
      edgeDef.prepare({ ...INPUT, payload: { setpoint: 'hot' } }),
    ).rejects.toBeInstanceOf(ActionValidationError);
    await expect(
      edgeDef.prepare({ ...INPUT, payload: { setpoint: 22, extra: 'ignored' } }),
    ).resolves.toBeDefined();
  });

  it('fails guardrails closed on unsupported operators', () => {
    const result = evaluateConditions(
      [{ type: 'parameter_range', field: 'setpoint', operator: 'bogus' as never, value: 1 }],
      { setpoint: 22 },
      {},
    );
    expect(result.passed).toBe(false);
  });

  it('treats a denied authority decision as a governance error', () => {
    const proposal: ActionProposal = {
      ...createProposal({ kind: 'temp.set', parameters: { setpoint: 22 }, context: { zoneId: 'z' } }),
      authorityDecision: {
        allowed: false,
        reason: 'out of scope',
        matchedRules: [],
        failedRules: ['scope'],
        intentId: 'i',
        mandateId: 'm',
        decisionId: 'd',
        evaluatedAt: 0,
        policyVersion: 'v1',
        mandateVerification: {
          valid: false,
          identityVerified: false,
          scopeMatch: false,
          usageExceeded: false,
          expired: false,
          identityRevoked: false,
          mandateRevoked: false,
        },
        usageSnapshot: { mandateProofId: 'm', totalCount: 0 },
        usageSnapshotHash: 'h',
        evidenceIds: [],
      },
    };
    expect(checkGovernanceConstraints(proposal, 1)).not.toHaveLength(0);
  });

  it('rejects a receipt whose authority binding is tampered', async () => {
    const edgeDef = toEdgeActionDefinition(makeDefinition());
    const prepared = (await edgeDef.prepare({ ...INPUT, mandateProofId: 'm1' })) as PreparedDeviceOp;
    const result = (await edgeDef.execute(prepared)) as IndustrialExecutionResult;
    const receipt = result.receipt!;
    const tampered = {
      ...receipt,
      payload: { ...receipt.payload, mandateProofId: 'm2' },
    };
    const verified = verifyIndustrialReceipt(tampered);
    expect(verified.ok).toBe(false);
    expect(verified.errorCode).toBe('RECEIPT_TAMPERED');
  });

  it('does not double-actuate under concurrent replay', async () => {
    const actuate = jest.fn(async () => {
      await new Promise((r) => setTimeout(r, 5));
      return { ok: true, data: { applied: true } };
    });
    const store = createDurableDeviceOperationStore(new MemoryStore(), { requireAckMode: 'volatile' });
    const edgeDef = toEdgeActionDefinition(makeDefinition({ actuate }), { operationStore: store });
    const prepared = (await edgeDef.prepare(INPUT)) as PreparedDeviceOp;

    await Promise.all([edgeDef.execute(prepared), edgeDef.execute(prepared), edgeDef.execute(prepared)]);
    expect(actuate).toHaveBeenCalledTimes(1);
  });
});

describe('crash / restart under load (RFC-010 P5)', () => {
  it('survives restart and still dedups actuation', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'totem-industrial-action-'));
    let operationId: string;

    {
      const actuate = jest.fn().mockResolvedValue({ ok: true, data: { applied: true } });
      const store = createDurableDeviceOperationStore(new FileStore(dir), {});
      const edgeDef = toEdgeActionDefinition(makeDefinition({ actuate }), { operationStore: store });
      const prepared = (await edgeDef.prepare(INPUT)) as PreparedDeviceOp;
      operationId = prepared.operationId;
      await edgeDef.execute(prepared);
      expect(actuate).toHaveBeenCalledTimes(1);
    }

    {
      const actuate = jest.fn();
      const store = createDurableDeviceOperationStore(new FileStore(dir), {});
      const record = await store.getOperation(operationId);
      expect(record?.status).toBe('confirmed');

      const edgeDef = toEdgeActionDefinition(makeDefinition({ actuate }), { operationStore: store });
      const prepared = (await edgeDef.prepare(INPUT)) as PreparedDeviceOp;
      const result = (await edgeDef.execute(prepared)) as IndustrialExecutionResult;
      expect(result.deduplicated).toBe(true);
      expect(actuate).not.toHaveBeenCalled();
    }
  });

  it('admits exactly one claim under concurrent load', async () => {
    const store = createDurableDeviceOperationStore(new MemoryStore(), { requireAckMode: 'volatile' });
    const claims = await Promise.all(
      Array.from({ length: 25 }, () => store.claimOperation('op-load', 'p1', Date.now())),
    );
    expect(claims.filter((c) => c.claimed)).toHaveLength(1);
  });

  it('persists many operations and reopens the whole set', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'totem-industrial-action-load-'));
    const ids: string[] = [];
    {
      const store = createDurableDeviceOperationStore(new FileStore(dir), {});
      const edgeDef = toEdgeActionDefinition(makeDefinition(), { operationStore: store });
      for (let i = 0; i < 20; i++) {
        const prepared = (await edgeDef.prepare({
          ...INPUT,
          payload: { setpoint: 20 + i },
        })) as PreparedDeviceOp;
        ids.push(prepared.operationId);
        await edgeDef.execute(prepared);
      }
    }
    {
      const store = createDurableDeviceOperationStore(new FileStore(dir), {});
      for (const id of ids) {
        expect((await store.getOperation(id))?.status).toBe('confirmed');
      }
    }
  });
});
