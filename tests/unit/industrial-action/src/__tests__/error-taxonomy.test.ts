/**
 * RFC-011 Phase C — device error taxonomy.
 */

import { createDeviceErrorTaxonomy } from '../error-taxonomy.js';
import { runWithPolicy, toEdgeActionDefinition } from '../edge-adapter.js';
import type { IndustrialActionDefinition, PreparedDeviceOp } from '../edge-adapter.js';
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

const preparedFor = async (def: IndustrialActionDefinition): Promise<PreparedDeviceOp> =>
  (await toEdgeActionDefinition(def).prepare(INPUT)) as PreparedDeviceOp;

describe('DeviceErrorTaxonomy (RFC-011 §4.7)', () => {
  const taxonomy = createDeviceErrorTaxonomy();

  it('classifies Modbus exception codes', () => {
    expect(taxonomy.classify('modbus', '2')).toMatchObject({ class: 'permanent', retryable: false, code: 'MODBUS:2' });
    expect(taxonomy.classify('modbus', 4)).toMatchObject({ class: 'transient', retryable: true });
  });

  it('classifies OPC-UA status codes', () => {
    expect(taxonomy.classify('opcua', 'BadTimeout')).toMatchObject({ class: 'transient', retryable: true });
    expect(taxonomy.classify('opcua', 'BadUserAccessDenied')).toMatchObject({ class: 'auth', retryable: false });
    expect(taxonomy.classify('opcua', 'BadOutOfService')).toMatchObject({
      class: 'safety',
      retryable: false,
      safeStateRequired: true,
    });
  });

  it('falls back to generic codes and unknown', () => {
    expect(taxonomy.classify(undefined, 'EXECUTION_TIMEOUT')).toMatchObject({ class: 'transient', retryable: true });
    expect(taxonomy.classify(undefined, { errorCode: 'EXECUTION_FAILED' })).toMatchObject({ class: 'permanent' });
    expect(taxonomy.classify('modbus', '999')).toMatchObject({ class: 'unknown', retryable: false });
  });

  it('supports profile-registered classifications', () => {
    const custom = createDeviceErrorTaxonomy();
    custom.register('modbus', '42', 'safety');
    expect(custom.classify('modbus', '42')).toMatchObject({ class: 'safety', safeStateRequired: true });
  });
});

describe('taxonomy-aware execution (RFC-011 §4.7/§4.11)', () => {
  const taxonomy = createDeviceErrorTaxonomy();

  it('retries a transient protocol error', async () => {
    const actuate = jest.fn().mockResolvedValue({ ok: false, error: 'busy', errorCode: '4' });
    const def = makeDefinition({
      protocol: 'modbus',
      errorTaxonomy: taxonomy,
      policy: { failureMode: 'abort', maxAttempts: 3 },
      actuate,
    });
    await runWithPolicy(def, await preparedFor(def));
    expect(actuate).toHaveBeenCalledTimes(3);
  });

  it('does not retry a permanent protocol error', async () => {
    const actuate = jest.fn().mockResolvedValue({ ok: false, error: 'bad address', errorCode: '2' });
    const def = makeDefinition({
      protocol: 'modbus',
      errorTaxonomy: taxonomy,
      policy: { failureMode: 'abort', maxAttempts: 3 },
      actuate,
    });
    const result = await runWithPolicy(def, await preparedFor(def));
    expect(actuate).toHaveBeenCalledTimes(1);
    expect(result.outcome).toBe('aborted');
  });

  it('commands safe state on a safety-class device error', async () => {
    const safeState = jest.fn().mockResolvedValue({ ok: true });
    const actuate = jest.fn().mockResolvedValue({ ok: false, error: 'out of service', errorCode: 'BadOutOfService' });
    const def = makeDefinition({
      protocol: 'opcua',
      errorTaxonomy: taxonomy,
      policy: { failureMode: 'abort', maxAttempts: 3 },
      safeState,
      actuate,
    });
    const result = await runWithPolicy(def, await preparedFor(def));
    expect(actuate).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ outcome: 'safe-stated', safeStateApplied: true });
    expect(safeState).toHaveBeenCalledTimes(1);
  });
});
