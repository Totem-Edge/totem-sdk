/**
 * RFC-077 G1 — governed training action on the act-core lifecycle.
 *
 * The action resolves a host-owned TrainingPlan, derives compute/duration
 * effects from it, starts a provider-neutral TrainingPort job, and reconciles
 * through `inspect`. It never depends on QVAC and never exposes the plan map or
 * port to an agent.
 */

import {
  hashCanonical,
  type DeviceOperationRecord,
  type IndustrialActionDefinition,
  type PreparedDeviceOp,
} from '@totemsdk/act-core';
import type { StepEffects } from '@totemsdk/agent-policy';
import type {
  TrainingObservation,
  TrainingRequest,
  TrainingRunDescriptorV1,
} from '@totemsdk/intelligence/training';

import { TRAINING_ACTION, TRAINING_CAPABILITY, type TrainingActionOptions, type TrainingPlan } from './types.js';

interface TrainingCommand {
  readonly planId: string;
  readonly runId: string;
  readonly request: TrainingRequest;
  readonly resourceEnvelope: TrainingPlan['resourceEnvelope'];
  readonly commandDigest: string;
}

function stringParameter(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`training: ${name} must be a non-empty string`);
  }
  return value;
}

function planFromCommand(op: PreparedDeviceOp): { command: TrainingCommand; plan: TrainingPlan } {
  const command = op.command as TrainingCommand | undefined;
  if (!command || typeof command !== 'object') {
    throw new Error('training: prepared command is missing');
  }
  const plan = (op as unknown as { plan?: TrainingPlan }).plan;
  if (!plan) throw new Error('training: prepared command is not bound to a plan');
  return { command, plan };
}

/** The descriptor's `preparedCommandDigest` is the plan commitment. */
export function computeTrainingPlanDigest(plan: TrainingPlan): string {
  const { preparedCommandDigest: _ignored, ...descriptor } = plan.descriptor;
  return hashCanonical('TOTEM_ACT_TRAINING_COMMAND_V1', {
    planId: plan.planId,
    descriptor,
    trainingExampleIds: plan.trainingExampleIds,
    resourceEnvelope: plan.resourceEnvelope,
  });
}

/** Seal a host-owned plan and bind the resulting digest into its descriptor. */
export function sealTrainingPlan(
  plan: Omit<TrainingPlan, 'descriptor'> & {
    descriptor: Omit<TrainingRunDescriptorV1, 'preparedCommandDigest'>;
  },
): TrainingPlan {
  const draft: TrainingPlan = {
    ...plan,
    descriptor: { ...plan.descriptor, preparedCommandDigest: '' },
  };
  const preparedCommandDigest = computeTrainingPlanDigest(draft);
  return {
    ...draft,
    descriptor: { ...draft.descriptor, preparedCommandDigest },
  };
}

function commandDigest(plan: TrainingPlan): string {
  return computeTrainingPlanDigest(plan);
}

function jobRefOf(record: DeviceOperationRecord, op: PreparedDeviceOp): string | undefined {
  if (typeof record.handle === 'string') return record.handle;
  const result = record.result as { jobRef?: unknown } | undefined;
  if (result && typeof result.jobRef === 'string') return result.jobRef;
  const command = op.command as { jobRef?: unknown } | undefined;
  return command && typeof command.jobRef === 'string' ? command.jobRef : undefined;
}

function reconcileObservation(observation: TrainingObservation, jobRef: string) {
  switch (observation.status) {
    case 'confirmed':
      return {
        status: 'confirmed' as const,
        handle: jobRef,
        result: observation.adapterRef,
        progress: { fraction: 1, detail: 'training confirmed', at: Date.now() },
      };
    case 'failed':
      return {
        status: 'failed' as const,
        handle: jobRef,
        error: observation.error ?? 'training failed',
      };
    case 'cancelled':
      return {
        status: 'failed' as const,
        handle: jobRef,
        error: observation.error ?? 'training cancelled',
      };
    case 'accepted':
    case 'running':
      return {
        status: observation.status,
        handle: jobRef,
        progress: {
          ...(observation.progress !== undefined ? { fraction: observation.progress } : {}),
          detail: `training ${observation.status}`,
          at: Date.now(),
        },
      };
    case 'unknown':
    default:
      return {
        status: 'unknown' as const,
        handle: jobRef,
        error: observation.error ?? 'training outcome unknown',
      };
  }
}

export function createTrainingActionDefinitions(
  options: TrainingActionOptions,
): IndustrialActionDefinition[] {
  const actionKind = options.actionKind ?? TRAINING_ACTION;
  const capability = options.capability ?? TRAINING_CAPABILITY;

  const definition: IndustrialActionDefinition = {
    kind: actionKind,
    description: 'Start a frozen, host-approved training plan through a provider-neutral TrainingPort.',
    version: 1,
    capability,
    effect: 'write',
    schema: {
      parameters: [
        { name: 'planId', type: 'string', required: true, description: 'Host-approved training plan id.' },
        { name: 'reason', type: 'string', required: false, description: 'Operator/agent reason for audit.' },
      ],
      context: [],
    },
    policy: { failureMode: 'abort', timeoutMs: 30_000, maxAttempts: 1 },

    async prepare(params) {
      const planId = stringParameter(params.planId, 'planId');
      const plan = options.plans[planId];
      if (!plan) throw new Error(`training: unknown plan '${planId}'`);

      const expected = commandDigest(plan);
      if (plan.descriptor.preparedCommandDigest !== expected) {
        throw new Error('training: plan descriptor digest does not match the prepared command');
      }
      if (plan.descriptor.runId.length === 0) throw new Error('training: plan has no run id');
      if (plan.trainingExampleIds.length === 0) throw new Error('training: plan has no training examples');

      const request: TrainingRequest = {
        runId: plan.descriptor.runId,
        baseModel: plan.descriptor.baseModel,
        collectionId: plan.descriptor.collectionId,
        trainingExampleIds: plan.trainingExampleIds,
        hyperparameters: plan.descriptor.hyperparameters,
        seeds: plan.descriptor.seeds,
        outputPolicy: plan.descriptor.outputPolicy,
      };

      const command: TrainingCommand = {
        planId,
        runId: plan.descriptor.runId,
        request,
        resourceEnvelope: plan.resourceEnvelope,
        commandDigest: expected,
      };

      return {
        resourceId: options.resourceId,
        // Carry the plan on the prepared op so effects/reconciliation cannot
        // be derived from an agent-provided substitute.
        plan,
        command,
      } as unknown as PreparedDeviceOp;
    },

    deriveEffects(op): StepEffects {
      const { plan } = planFromCommand(op);
      const envelope = plan.resourceEnvelope;
      return {
        spends: [],
        compute: [{ ...envelope }],
        physical: {
          duration: [{ resource: options.resourceId, seconds: envelope.maxWallSeconds }],
        },
      };
    },

    async actuate(op) {
      const { command } = planFromCommand(op);
      const prepared = await options.port.prepare(command.request);
      const started = await options.port.start(prepared, op.operationId);
      if (started.status !== 'accepted') {
        return { ok: false, error: started.reason, errorCode: 'TRAINING_START_REJECTED' };
      }
      return {
        ok: true,
        data: {
          jobRef: started.jobRef,
          operationId: op.operationId,
          trainingRunId: command.runId,
          providerOperationId: started.operationId,
          preparedCommandDigest: prepared.preparedCommandDigest,
        },
      };
    },

    async: {
      confirmation: 'accepted',
      async reconcile(op, record) {
        const jobRef = jobRefOf(record, op);
        if (!jobRef) return { status: 'unknown', error: 'training: no job reference to reconcile' };
        const observation = await options.port.inspect(jobRef);
        return reconcileObservation(observation, jobRef);
      },
      async cancel(op, record) {
        const jobRef = jobRefOf(record, op);
        if (!jobRef) throw new Error('training: no job reference to cancel');
        const acknowledgement = await options.port.cancel(jobRef);
        if (!acknowledgement.acknowledged) {
          throw new Error('training: provider did not acknowledge cancellation');
        }
      },
    },
  };

  return [definition];
}
