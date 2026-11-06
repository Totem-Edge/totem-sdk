/**
 * RFC-077 G1 — governed training action tests.
 */

import { createHash } from 'node:crypto';
import {
  checkRunLimits,
  type AutonomyProfile,
  type CanonicalAgentAction,
  type GrantBoundAutonomyPolicy,
} from '@totemsdk/agent-policy';
import { createAgentEdgeRuntime, createCapabilitySet, createEdgeActionRegistry } from '@totemsdk/edge';
import {
  toEdgeActionDefinition,
  type DeviceOperationRecord,
  type PreparedDeviceOp,
} from '@totemsdk/act-core';
import {
  createFakeTrainer,
  sealTrainingRunDescriptor,
  type CanonicalDigest,
  type TrainingArtifactRef,
} from '@totemsdk/intelligence/training';

import {
  computeTrainingPlanDigest,
  createTrainingActionDefinitions,
  sealTrainingPlan,
  TRAINING_ACTION,
  type TrainingPlan,
} from '../../../../../packages/act-training/src/index.js';

const digest: CanonicalDigest = (domain, body) =>
  createHash('sha3-256').update(domain + body).digest('hex');

function artifact(label: string): TrainingArtifactRef {
  return { namespace: 'test', algorithm: 'sha3-256', digest: digest('TOTEM_TEST_ARTIFACT_V1', label) };
}

function descriptor(overrides: Record<string, unknown> = {}) {
  return sealTrainingRunDescriptor({
    schema: 'totem:training:run-descriptor/v1',
    baseModel: artifact('base-model'),
    collectionId: 'collection-1',
    collectionDigest: digest('TOTEM_TEST_COLLECTION_V1', 'collection-1'),
    trainingSplit: 'train',
    taskId: 'task-1',
    codeDigest: 'code-1',
    environmentDigest: 'env-1',
    providerId: 'fake-trainer',
    providerVersion: 'slice0',
    hyperparameters: { epochs: 1 },
    seeds: [7],
    resourceEnvelope: { cpuSeconds: '10' },
    outputPolicy: 'candidate-only',
    rightsRefs: ['rights-1'],
    preparedCommandDigest: '',
    createdAt: 1_000,
    ...overrides,
  }, digest);
}

function plan(overrides: Record<string, unknown> = {}): TrainingPlan {
  return sealTrainingPlan({
    planId: 'plan-1',
    descriptor: descriptor(overrides),
    trainingExampleIds: ['example-1'],
    resourceEnvelope: {
      resourceId: 'host/cpu/0',
      maxWallSeconds: '60',
      maxCpuSeconds: '10',
      maxMemoryBytes: '1024',
      maxDiskBytes: '1024',
      maxNetworkBytes: '0',
    },
  });
}

function makeDefs(trainingPlan: TrainingPlan) {
  const trainer = createFakeTrainer({ digest });
  const [definition] = createTrainingActionDefinitions({
    port: trainer.port,
    plans: { [trainingPlan.planId]: trainingPlan },
    resourceId: 'host/cpu/0',
  });
  return { trainer, definition, edgeDef: toEdgeActionDefinition(definition) };
}

const INPUT = {
  action: TRAINING_ACTION,
  subject: 'host-1',
  payload: { planId: 'plan-1' },
  context: {},
};

describe('RFC-077 G1 governed training action', () => {
  it('binds the host plan into the prepared command', async () => {
    const trainingPlan = plan();
    const { edgeDef } = makeDefs(trainingPlan);

    const op = (await edgeDef.prepare(INPUT)) as PreparedDeviceOp & { plan?: TrainingPlan };
    expect(op.preparedCommandHash).toBeDefined();
    expect(op.plan?.planId).toBe('plan-1');
    expect(trainingPlan.descriptor.preparedCommandDigest).toBe(computeTrainingPlanDigest(trainingPlan));
    expect((op.command as { commandDigest: string }).commandDigest).toBe(trainingPlan.descriptor.preparedCommandDigest);

    const effects = edgeDef.deriveEffects(op);
    expect(effects.compute?.[0]).toMatchObject({ resourceId: 'host/cpu/0', maxCpuSeconds: '10' });
    expect(effects.physical?.duration?.[0]).toEqual({ resource: 'host/cpu/0', seconds: '60' });
  });

  it('rejects unknown or substituted plans before dispatch', async () => {
    const trainingPlan = plan();
    const { edgeDef } = makeDefs(trainingPlan);

    await expect(edgeDef.prepare({ ...INPUT, payload: { planId: 'missing' } })).rejects.toThrow(/unknown plan/);

    const tampered = {
      ...trainingPlan,
      descriptor: { ...trainingPlan.descriptor, collectionId: 'other-collection' },
    } as TrainingPlan;
    const { edgeDef: tamperedDef } = makeDefs(tampered);
    await expect(tamperedDef.prepare(INPUT)).rejects.toThrow(/digest/);
  });

  it('reports acceptance as non-terminal and reconciles through the training port', async () => {
    const trainingPlan = plan();
    const { definition, edgeDef } = makeDefs(trainingPlan);
    const op = (await edgeDef.prepare(INPUT)) as PreparedDeviceOp;

    const result = await edgeDef.execute(op);
    expect(result.ok).toBe(true);
    expect(result.dispatchState).toBe('dispatched');
    expect(result.phase).toBe('accepted');
    expect(result.terminalOutcome).toBeUndefined();
    expect(result.data).toMatchObject({ operationId: op.operationId });

    const record: DeviceOperationRecord = {
      operationId: op.operationId,
      status: 'accepted',
      attempts: 1,
      updatedAt: Date.now(),
      result: result.data,
    };
    const progress = await definition.async?.reconcile?.(op, record);
    expect(progress?.status).toBe('confirmed');
    expect(progress?.result).toMatchObject({ namespace: 'training/adapters' });
  });

  it('cancels through the training port', async () => {
    const trainingPlan = plan();
    const { definition, edgeDef } = makeDefs(trainingPlan);
    const op = (await edgeDef.prepare(INPUT)) as PreparedDeviceOp;
    const result = await edgeDef.execute(op);
    const record: DeviceOperationRecord = {
      operationId: op.operationId,
      status: 'accepted',
      attempts: 1,
      updatedAt: Date.now(),
      result: result.data,
    };
    await expect(definition.async?.cancel?.(op, record)).resolves.toBeUndefined();
  });

  it('rejects a compute envelope above the autonomy ceiling', async () => {
    const trainingPlan = plan();
    const { edgeDef } = makeDefs(trainingPlan);
    const op = (await edgeDef.prepare(INPUT)) as PreparedDeviceOp;
    const effects = edgeDef.deriveEffects(op);
    const action: CanonicalAgentAction = {
      action: TRAINING_ACTION,
      principal: 'principal-1',
      agent: 'agent-1',
      target: 'host-1',
      effects,
      runId: 'run-1',
      stepId: 'step-1',
      nonce: 'nonce-1',
    };
    const profile: AutonomyProfile = {
      profileId: 'training',
      mode: 'dynamic',
      runLimits: { compute: { maxCpuSeconds: '5', allowedResources: ['host/cpu/0'] } },
    };

    const boundary = checkRunLimits(profile, action, {
      committedSteps: 0,
      reservedSteps: 0,
      abortedSteps: 0,
      spentByToken: {},
      feesByToken: {},
      outstandingByToken: {},
      now: 1_000,
      startedAt: 0,
    });
    expect(boundary).toMatchObject({ kind: 'boundary_exceeded', reason: 'maxCpuSeconds' });
  });

  it('holds an accepted training job in AgentEdgeRuntime', async () => {
    const trainingPlan = plan();
    const { edgeDef } = makeDefs(trainingPlan);

    const commit = jest.fn();
    const abort = jest.fn();
    const policy = {
      authorizeAndReserve: async () => ({
        outcome: 'approved' as const,
        reservationId: 'res-1',
        actionDigest: 'digest-1',
        decisionIds: [],
        mandateIds: ['mandate-1'],
        usageDeltas: [],
        reservedAt: 1_000,
        expiresAt: 2_000,
      }),
      commit,
      abort,
    } as unknown as GrantBoundAutonomyPolicy;

    const registry = createEdgeActionRegistry();
    registry.register(edgeDef, TRAINING_ACTION);
    const runtime = createAgentEdgeRuntime({
      deviceId: 'host-1',
      capabilities: createCapabilitySet(['intelligence:llm:finetune']),
      registry,
      policy,
      runId: 'run-1',
      principal: 'principal-1',
      agentId: 'agent-1',
    });

    const result = await runtime.executeAction(INPUT);
    expect(result.ok).toBe(true);
    expect(result.dispatchState).toBe('dispatched');
    expect(result.phase).toBe('accepted');
    expect(commit).not.toHaveBeenCalled();
    expect(abort).not.toHaveBeenCalled();
  });
});
