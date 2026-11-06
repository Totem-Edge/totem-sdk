/**
 * RFC-077 G1 integration — built packages, accepted hold and reconciliation.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

import { init } from '../../../packages/core/dist/index.js';
import { toEdgeActionDefinition } from '../../../packages/act-core/dist/index.js';
import {
  createTrainingActionDefinitions,
  sealTrainingPlan,
  TRAINING_ACTION,
} from '../../../packages/act-training/dist/index.js';
import {
  createFakeTrainer,
  sealTrainingRunDescriptor,
} from '../../../packages/intelligence/dist/training/index.js';

const coreGlue = new URL('../../../packages/core-wasm/pkg-web/totemsdk_core_wasm.js', import.meta.url);
await init({
  module_or_path: readFileSync(new URL('./totemsdk_core_wasm_bg.wasm', coreGlue)),
});

const digest = (domain, body) =>
  createHash('sha3-256').update(domain + body).digest('hex');
const artifact = (label) => ({
  namespace: 'test',
  algorithm: 'sha3-256',
  digest: digest('TOTEM_TEST_ARTIFACT_V1', label),
});

test('packed training action holds acceptance and reconciles through TrainingPort', async () => {
  const descriptor = sealTrainingRunDescriptor({
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
  }, digest);

  const plan = sealTrainingPlan({
    planId: 'plan-1',
    descriptor,
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

  const trainer = createFakeTrainer({ digest });
  const [definition] = createTrainingActionDefinitions({
    port: trainer.port,
    plans: { 'plan-1': plan },
    resourceId: 'host/cpu/0',
  });
  const edgeDef = toEdgeActionDefinition(definition);

  const op = await edgeDef.prepare({
    action: TRAINING_ACTION,
    subject: 'host-1',
    payload: { planId: 'plan-1' },
    context: {},
  });
  const result = await edgeDef.execute(op);
  assert.equal(result.ok, true);
  assert.equal(result.dispatchState, 'dispatched');
  assert.equal(result.phase, 'accepted');
  assert.equal(result.terminalOutcome, undefined);

  const progress = await definition.async.reconcile(op, {
    operationId: op.operationId,
    status: 'accepted',
    attempts: 1,
    updatedAt: Date.now(),
    result: result.data,
  });
  assert.equal(progress.status, 'confirmed');
  assert.equal(progress.result.algorithm, 'sha3-256');
});
