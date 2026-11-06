/**
 * RFC-077 Slice 0 — contracts, fakes, independent evaluation and release gates.
 * No model accuracy claim is made; these tests prove record semantics.
 */

import { createHash } from 'node:crypto';
import {
  assertValidTrainingCollection,
  assertValidTrainingExample,
  computeExampleId,
  computeExampleRoot,
  computeSplitCommitments,
  createFakeEvaluator,
  createFakeTrainer,
  createInMemoryReleasePointer,
  isTrainingEligible,
  runFakeTrainingSlice,
  sealModelRelease,
  sealTrainingCollection,
  sealTrainingExample,
  type CanonicalDigest,
  type EvaluationReportV1,
  type EvaluationTaskV1,
  type ModelReleaseDescriptorV1,
  type TrainingArtifactRef,
  type TrainingCollectionV1,
  type TrainingExampleV1,
  type TrainingSplit,
} from '../../../../../packages/intelligence/src/training/index.js';

const digest: CanonicalDigest = (domain, body) =>
  createHash('sha3-256').update(domain + body).digest('hex');

function artifact(label: string): TrainingArtifactRef {
  return {
    namespace: 'test',
    algorithm: 'sha3-256',
    digest: digest('TOTEM_TEST_ARTIFACT_V1', label),
  };
}

function makeExample(options: {
  label?: string;
  split?: TrainingSplit;
  outcome?: 'success' | 'failure' | 'unknown' | 'unsafe';
  disagreement?: boolean;
} = {}): TrainingExampleV1 {
  const label = options.label ?? 'a';
  const outcome = options.outcome ?? 'success';
  const epistemicStatus = options.disagreement ? 'disputed' : 'verified';
  return sealTrainingExample({
    schema: 'totem:training:example/v1',
    task: {
      taskId: 'task-1',
      schemaRef: artifact('schema'),
      schemaVersion: '1',
    },
    sourceRefs: [`source:${label}`],
    inputs: [{
      modality: 'text',
      artifactRef: artifact(`input:${label}`),
      mediaType: 'text/plain',
      encoding: 'utf-8',
    }],
    target: {
      kind: 'class',
      artifactRef: artifact(`target:${label}`),
    },
    label: {
      sourceRef: `label:${label}`,
      epistemicStatus,
      confidence: '0.9',
    },
    outcome,
    outcomeEvidenceRefs: [`evidence:${label}:outcome`],
    supportingEvidenceRefs: [`evidence:${label}:support`],
    counterEvidenceRefs: options.disagreement ? [`evidence:${label}:counter`] : [],
    ...(options.disagreement
      ? { labelDisagreement: { conflictingLabelRefs: ['motor:success', 'camera:drop'] } }
      : {}),
    transformDigest: digest('TOTEM_TEST_TRANSFORM_V1', 'identity'),
    rightsRef: artifact('rights'),
    redaction: { status: 'none' },
    qualityFlags: [],
    split: options.split ?? 'train',
  }, digest);
}

function makeTask(heldOutCommitment: string, sampleSize = 1): EvaluationTaskV1 {
  return {
    schema: 'totem:training:evaluation-task/v1',
    taskId: 'task-1',
    taskSchemaRef: artifact('task-schema'),
    inputDistribution: 'slice0 synthetic',
    targetMetric: 'accuracy',
    metrics: ['accuracy', 'regression'],
    safetySuites: ['slice0-safety'],
    abstention: 'required',
    sampleSize,
    statistics: { method: 'fixed-slice', confidence: 'none' },
    thresholds: { minScore: '0.8', maxRegression: '0.05', safetyPass: true },
    heldOutCommitment,
    harnessDigest: digest('TOTEM_TEST_HARNESS_V1', 'harness'),
    baselineId: 'naive-baseline',
    createdAt: 500,
  };
}

function makeRelease(
  report: EvaluationReportV1,
  options: { trainerId?: string; collectionId?: string } = {},
): ModelReleaseDescriptorV1 {
  return sealModelRelease({
    schema: 'totem:training:model-release/v1',
    issuerId: 'issuer-1',
    trainerId: options.trainerId ?? 'trainer-1',
    baseModel: artifact('base-model'),
    adapter: artifact('adapter'),
    config: artifact('config'),
    trainingRunId: 'run-1',
    collectionId: options.collectionId ?? 'collection-1',
    evaluationReportIds: [report.reportId],
    evaluationClassification: report.evaluatorId === (options.trainerId ?? 'trainer-1')
      ? 'self-evaluated'
      : 'independent',
    capabilities: ['task:slice0'],
    limitations: ['fake'],
    hardware: ['cpu'],
    permittedUses: ['test-only'],
    approval: {
      decisionId: 'approval-1',
      approvedBy: 'issuer-1',
      approvedAt: 5_000,
      evaluationReportId: report.reportId,
    },
    issuedAt: 5_000,
  }, digest);
}

describe('RFC-077 Slice 0 — records and zero-GPU lifecycle', () => {
  it('seals deterministic example ids and detects label tampering', () => {
    const example = makeExample({ label: 'a' });
    expect(computeExampleId(example, digest)).toBe(example.exampleId);
    expect(() => assertValidTrainingExample(example, digest)).not.toThrow();

    const tampered = {
      ...example,
      label: { ...example.label, epistemicStatus: 'inferred' as const },
    };
    expect(computeExampleId(tampered, digest)).not.toBe(example.exampleId);
    expect(() => assertValidTrainingExample(tampered, digest)).toThrow(/canonical body/);
  });

  it('preserves label disagreement and excludes it from training', () => {
    const example = makeExample({ label: 'pickup', outcome: 'unknown', disagreement: true });
    expect(example.labelDisagreement?.conflictingLabelRefs).toEqual(['motor:success', 'camera:drop']);
    expect(isTrainingEligible(example)).toBe(false);
  });

  it('freezes collection membership, splits and the held-out precommit', () => {
    const train = makeExample({ label: 'train-a', split: 'train' });
    const test = makeExample({ label: 'test-a', split: 'test' });
    const splitExampleIds = {
      train: [train.exampleId],
      validation: [],
      test: [test.exampleId],
      excluded: [],
    } as const;
    const splitCommitments = computeSplitCommitments(splitExampleIds, digest);
    const exampleIds = [train.exampleId, test.exampleId];
    const collection = sealTrainingCollection({
      schema: 'totem:training:collection/v1',
      exampleRoot: computeExampleRoot(exampleIds, digest),
      exampleIds,
      splitExampleIds,
      selectionRuleDigest: digest('TOTEM_TEST_SELECTION_V1', 'all'),
      sourceSnapshot: { journalRanges: ['j:1'], commitments: ['c:1'], from: 0, to: 10 },
      splitCommitments,
      splitPolicy: {
        grouping: 'none',
        temporalIsolation: true,
        benchmarkFreshness: 'single-use',
      },
      exclusions: [],
      rightsPolicyRef: artifact('rights'),
      qualityReport: {
        classCounts: { success: 2 },
        modalities: { text: 2 },
        duplicateCount: 0,
        missingLabels: 0,
        contradictoryLabels: 0,
      },
      holdoutPrecommit: {
        commitment: splitCommitments.test,
        committedAt: 0,
        policyDigest: digest('TOTEM_TEST_HOLDOUT_V1', 'policy'),
      },
      composerRef: 'composer-1',
      createdAt: 1_000,
    }, digest);

    expect(() => assertValidTrainingCollection(collection, digest)).not.toThrow();

    const { collectionId: _id, ...body } = collection;
    const tamperedRoot = sealTrainingCollection({
      ...body,
      exampleRoot: digest('tamper', 'root'),
    }, digest);
    expect(() => assertValidTrainingCollection(tamperedRoot, digest)).toThrow(/root/);

    const duplicateIds = { ...body.splitExampleIds, validation: [test.exampleId] };
    const duplicateSplit = sealTrainingCollection({
      ...body,
      splitExampleIds: duplicateIds,
      splitCommitments: computeSplitCommitments(duplicateIds, digest),
    }, digest);
    expect(() => assertValidTrainingCollection(duplicateSplit, digest)).toThrow(/more than one split/);

    const missingHoldout = sealTrainingCollection({
      ...body,
      holdoutPrecommit: { ...body.holdoutPrecommit, commitment: digest('tamper', 'holdout') },
    }, digest);
    expect(() => assertValidTrainingCollection(missingHoldout, digest)).toThrow(/held-out/);
  });

  it('requires an independent evaluator and denies promotion on failure or self-certification', async () => {
    const test = makeExample({ label: 'test-a', split: 'test' });
    const task = makeTask(computeExampleRoot([test.exampleId], digest));
    const evaluator = createFakeEvaluator({
      evaluatorId: 'evaluator-1',
      harnessDigest: task.harnessDigest,
      digest,
    });
    const report = await evaluator.evaluate({
      task,
      candidateRef: 'candidate-1',
      activeRef: 'active-1',
      baselineRef: 'baseline-1',
      heldOutExamples: [test],
    });
    expect(report.disposition).toBe('pass');
    expect(report.evaluatorId).toBe('evaluator-1');

    const pointer = createInMemoryReleasePointer(digest);
    const release = makeRelease(report);
    await expect(pointer.promote(release, report, {
      expectedHeldOutCommitment: task.heldOutCommitment,
      expectedCollectionId: release.collectionId,
    })).resolves.toMatchObject({ ok: true });
    expect(pointer.getActive()?.releaseId).toBe(release.releaseId);

    const failing = createFakeEvaluator({
      evaluatorId: 'evaluator-1',
      harnessDigest: task.harnessDigest,
      disposition: 'fail',
      digest,
    });
    const failingReport = await failing.evaluate({
      task,
      candidateRef: 'candidate-1',
      activeRef: 'active-1',
      baselineRef: 'baseline-1',
      heldOutExamples: [test],
    });
    const failingRelease = makeRelease(failingReport);
    await expect(pointer.promote(failingRelease, failingReport)).resolves.toMatchObject({
      ok: false,
      reason: expect.stringContaining('fail'),
    });

    const selfEvaluator = createFakeEvaluator({
      evaluatorId: 'trainer-1',
      harnessDigest: task.harnessDigest,
      digest,
    });
    const selfReport = await selfEvaluator.evaluate({
      task,
      candidateRef: 'candidate-1',
      activeRef: 'active-1',
      baselineRef: 'baseline-1',
      heldOutExamples: [test],
    });
    const selfRelease = makeRelease(selfReport, { trainerId: 'trainer-1' });
    await expect(pointer.promote(selfRelease, selfReport)).resolves.toMatchObject({
      ok: false,
      reason: expect.stringContaining('trainer'),
    });
  });

  it('rolls back to the previous known-good release', async () => {
    const test = makeExample({ label: 'test-a', split: 'test' });
    const task = makeTask(computeExampleRoot([test.exampleId], digest));
    const evaluator = createFakeEvaluator({
      evaluatorId: 'evaluator-1',
      harnessDigest: task.harnessDigest,
      digest,
    });
    const report = await evaluator.evaluate({
      task,
      candidateRef: 'candidate-1',
      activeRef: 'active-1',
      baselineRef: 'baseline-1',
      heldOutExamples: [test],
    });

    const initial = makeRelease(report);
    const pointer = createInMemoryReleasePointer(digest, initial);
    const next = makeRelease(report, { collectionId: 'collection-2' });
    await expect(pointer.promote(next, report, {
      expectedHeldOutCommitment: task.heldOutCommitment,
      expectedCollectionId: next.collectionId,
    })).resolves.toMatchObject({ ok: true });
    expect(pointer.getActive()?.releaseId).toBe(next.releaseId);

    await expect(pointer.rollback()).resolves.toMatchObject({ ok: true });
    expect(pointer.getActive()?.releaseId).toBe(initial.releaseId);
  });

  it('reports fake trainer failure honestly and never fabricates an adapter', async () => {
    const trainer = createFakeTrainer({ digest, fail: true });
    const prepared = await trainer.port.prepare({
      runId: 'run-fail',
      baseModel: artifact('base-model'),
      collectionId: 'collection-1',
      trainingExampleIds: ['example-1'],
      hyperparameters: { epochs: 1 },
      seeds: [7],
      outputPolicy: 'candidate-only',
    });
    const started = await trainer.port.start(prepared, 'idem-fail');
    expect(started.status).toBe('accepted');
    if (started.status !== 'accepted') return;

    const observation = await trainer.port.inspect(started.jobRef);
    expect(observation.status).toBe('failed');
    expect(observation.adapterRef).toBeUndefined();
    expect((await trainer.port.capabilities()).checkpointResume).toBe(false);
  });

  it('excludes disputed training labels from the frozen training split', async () => {
    const train = makeExample({ label: 'train-ok', split: 'train' });
    const disputed = makeExample({
      label: 'train-disputed',
      split: 'train',
      outcome: 'unknown',
      disagreement: true,
    });
    const test = makeExample({ label: 'test-a', split: 'test' });
    const task = makeTask(computeExampleRoot([test.exampleId], digest));
    const evaluator = createFakeEvaluator({
      evaluatorId: 'evaluator-1',
      harnessDigest: task.harnessDigest,
      digest,
    });

    const result = await runFakeTrainingSlice({
      examples: [train, disputed, test],
      task,
      digest,
      issuerId: 'issuer-1',
      trainerId: 'trainer-1',
      evaluator,
      pointer: createInMemoryReleasePointer(digest),
      baseModel: artifact('base-model'),
      config: artifact('config'),
      activeRef: 'active-1',
      baselineRef: 'baseline-1',
    });

    expect(result.collection.splitExampleIds.train).toEqual([train.exampleId]);
    expect(result.collection.exclusions).toEqual([
      { exampleId: disputed.exampleId, reason: 'ineligible label/rights' },
    ]);
  });

  it('runs the full fake slice without a GPU or real model', async () => {
    const train = makeExample({ label: 'train-a', split: 'train' });
    const test = makeExample({ label: 'test-a', split: 'test' });
    const task = makeTask(computeExampleRoot([test.exampleId], digest));
    const evaluator = createFakeEvaluator({
      evaluatorId: 'evaluator-1',
      harnessDigest: task.harnessDigest,
      digest,
    });
    const pointer = createInMemoryReleasePointer(digest);

    const result = await runFakeTrainingSlice({
      examples: [train, test],
      task,
      digest,
      issuerId: 'issuer-1',
      trainerId: 'trainer-1',
      evaluator,
      pointer,
      baseModel: artifact('base-model'),
      config: artifact('config'),
      activeRef: 'active-1',
      baselineRef: 'baseline-1',
    });

    expect(result.collection.splitCommitments.test).toBe(task.heldOutCommitment);
    expect(result.terminal.status).toBe('confirmed');
    expect(result.report.disposition).toBe('pass');
    expect(result.release.evaluationClassification).toBe('independent');
    expect(result.promotion.ok).toBe(true);
    expect(pointer.getActive()?.releaseId).toBe(result.release.releaseId);
  });
});
