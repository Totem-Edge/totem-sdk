/**
 * RFC-077 Slice 0 — deterministic fake source, trainer, evaluator and release
 * pointer. No GPU, QVAC, Experience or real model is involved.
 */

import {
  assertValidEvaluationReport,
  assertValidModelRelease,
  assertValidTrainingCollection,
  assertValidTrainingExample,
  canonicalJson,
  computeExampleRoot,
  computeSplitCommitments,
  isTrainingEligible,
  sealEvaluationReport,
  sealModelRelease,
  sealTrainingCollection,
  sealTrainingRunDescriptor,
  type CanonicalDigest,
} from './canonical.js';
import type {
  EvaluationReportV1,
  EvaluationTaskV1,
  ModelReleaseDescriptorV1,
  PreparedTrainingJob,
  SourceSelection,
  SourceSnapshotRef,
  TrainingArtifactRef,
  TrainingCollectionV1,
  TrainingExampleSource,
  TrainingExampleV1,
  TrainingObservation,
  TrainingPort,
  TrainingRequest,
  TrainingRunDescriptorV1,
  TrainingRunTerminalV1,
  TrainingSplit,
} from './types.js';

// ── synthetic source ───────────────────────────────────────────────────────

export function createSyntheticExampleSource(
  examples: readonly TrainingExampleV1[],
  digest: CanonicalDigest,
): TrainingExampleSource {
  const byId = new Map<string, TrainingExampleV1>();
  for (const example of examples) {
    assertValidTrainingExample(example, digest);
    byId.set(example.exampleId, example);
  }

  return {
    async snapshot(query: SourceSelection): Promise<SourceSnapshotRef> {
      let selected = [...byId.values()];
      if (query.split !== undefined) selected = selected.filter((e) => e.split === query.split);
      if (query.limit !== undefined) selected = selected.slice(0, query.limit);
      const exampleIds = selected.map((e) => e.exampleId).sort();
      return {
        snapshotId: digest('TOTEM_TRAINING_SOURCE_SNAPSHOT_V1', canonicalJson({ exampleIds })),
        exampleIds,
      };
    },
    async resolve(ref: string) {
      const example = byId.get(ref);
      if (!example) throw new Error(`training: source example ${ref} not found`);
      return {
        example,
        evidenceRefs: [...example.supportingEvidenceRefs, ...example.counterEvidenceRefs],
      };
    },
  };
}

// ── fake trainer ───────────────────────────────────────────────────────────

export interface FakeTrainerOptions {
  readonly providerId?: string;
  readonly adapterNamespace?: string;
  readonly digest: CanonicalDigest;
  readonly fail?: boolean;
}

export interface FakeTrainer {
  readonly port: TrainingPort;
  readonly providerId: string;
}

export function createFakeTrainer(options: FakeTrainerOptions): FakeTrainer {
  const providerId = options.providerId ?? 'fake-trainer';
  const namespace = options.adapterNamespace ?? 'training/adapters';
  const prepared = new Map<string, PreparedTrainingJob>();

  const port: TrainingPort = {
    providerId,
    async capabilities() {
      return { providerId, supports: ['train', 'cancel'], checkpointResume: false };
    },
    async prepare(request: TrainingRequest): Promise<PreparedTrainingJob> {
      return {
        runId: request.runId,
        providerId,
        preparedCommandDigest: options.digest('TOTEM_TRAINING_PREPARED_JOB_V1', canonicalJson(request)),
        request,
      };
    },
    async start(job, idempotencyKey) {
      if (!idempotencyKey) return { status: 'rejected', reason: 'idempotency key is required' };
      const jobRef = `fake-job:${job.runId}:${idempotencyKey}`;
      prepared.set(jobRef, job);
      return { status: 'accepted', jobRef, operationId: job.runId };
    },
    async inspect(jobRef): Promise<TrainingObservation> {
      const job = prepared.get(jobRef);
      if (!job) return { status: 'unknown', error: 'unknown fake job' };
      if (options.fail) return { status: 'failed', error: 'fake training failure' };
      return {
        status: 'confirmed',
        adapterRef: {
          namespace,
          algorithm: 'sha3-256',
          digest: options.digest(
            'TOTEM_TRAINING_ADAPTER_V1',
            canonicalJson({ runId: job.runId, collectionId: job.request.collectionId, seeds: job.request.seeds }),
          ),
        },
      };
    },
    async cancel() {
      return { acknowledged: true };
    },
  };

  return { port, providerId };
}

// ── fake evaluator ─────────────────────────────────────────────────────────

export interface FakeEvaluatorOptions {
  readonly evaluatorId: string;
  readonly harnessDigest: string;
  readonly environmentDigest?: string;
  readonly disposition?: 'pass' | 'fail' | 'insufficient-evidence';
  readonly digest: CanonicalDigest;
}

export interface FakeEvaluationInput {
  readonly task: EvaluationTaskV1;
  readonly candidateRef: string;
  readonly activeRef: string;
  readonly baselineRef: string;
  readonly heldOutExamples: readonly TrainingExampleV1[];
}

export interface FakeEvaluator {
  readonly evaluatorId: string;
  readonly harnessDigest: string;
  readonly environmentDigest: string;
  evaluate(input: FakeEvaluationInput): Promise<EvaluationReportV1>;
}

export function createFakeEvaluator(options: FakeEvaluatorOptions): FakeEvaluator {
  const environmentDigest = options.environmentDigest ?? 'fake-environment';
  return {
    evaluatorId: options.evaluatorId,
    harnessDigest: options.harnessDigest,
    environmentDigest,
    async evaluate(input) {
      const ids = input.heldOutExamples.map((e) => e.exampleId);
      const root = computeExampleRoot(ids, options.digest);
      const allTest = input.heldOutExamples.every((e) => e.split === 'test');
      const enough = ids.length >= input.task.sampleSize;
      const requested = options.disposition ?? 'pass';
      const disposition = !allTest || root !== input.task.heldOutCommitment || !enough
        ? 'insufficient-evidence'
        : requested;

      const report = sealEvaluationReport({
        schema: 'totem:training:evaluation-report/v1',
        evaluatorId: options.evaluatorId,
        candidateReleaseId: input.candidateRef,
        activeReleaseId: input.activeRef,
        naiveBaselineId: input.baselineRef,
        heldOutCommitment: root,
        taskId: input.task.taskId,
        harnessDigest: options.harnessDigest,
        environmentDigest,
        seedPolicy: 'fixed',
        metrics: {
          accuracy: disposition === 'pass' ? '0.90' : '0.40',
          regression: '0.00',
          samples: String(ids.length),
        },
        safety: {
          passed: disposition !== 'fail',
          details: disposition === 'fail' ? ['fake safety regression'] : [],
        },
        abstention: {
          passed: true,
          details: [],
        },
        disposition,
        evidenceRefs: [input.task.harnessDigest, root],
        evaluatedAt: 4_000,
      }, options.digest);

      assertValidEvaluationReport(report, options.digest);
      return report;
    },
  };
}

// ── release pointer ────────────────────────────────────────────────────────

export interface PromotionOptions {
  readonly expectedHeldOutCommitment?: string;
  readonly expectedCollectionId?: string;
}

export interface PromotionResult {
  readonly ok: boolean;
  readonly reason?: string;
  readonly active?: ModelReleaseDescriptorV1;
}

export interface InMemoryReleasePointer {
  getActive(): ModelReleaseDescriptorV1 | undefined;
  promote(
    release: ModelReleaseDescriptorV1,
    report: EvaluationReportV1,
    options?: PromotionOptions,
  ): Promise<PromotionResult>;
  rollback(): Promise<PromotionResult>;
}

export function createInMemoryReleasePointer(
  digest: CanonicalDigest,
  initial?: ModelReleaseDescriptorV1,
): InMemoryReleasePointer {
  let active = initial;
  let previous: ModelReleaseDescriptorV1 | undefined;

  return {
    getActive() {
      return active;
    },
    async promote(release, report, options = {}) {
      assertValidModelRelease(release, digest);
      assertValidEvaluationReport(report, digest);

      if (report.disposition !== 'pass') {
        return { ok: false, reason: `evaluation disposition is ${report.disposition}` };
      }
      if (report.evaluatorId === release.trainerId) {
        return { ok: false, reason: 'trainer cannot certify its own release' };
      }
      if (!release.evaluationReportIds.includes(report.reportId)) {
        return { ok: false, reason: 'release does not list the evaluation report' };
      }
      if (release.approval.evaluationReportId !== report.reportId) {
        return { ok: false, reason: 'approval is not bound to the evaluation report' };
      }
      if (options.expectedHeldOutCommitment !== undefined
        && report.heldOutCommitment !== options.expectedHeldOutCommitment) {
        return { ok: false, reason: 'evaluation does not use the precommitted held-out set' };
      }
      if (options.expectedCollectionId !== undefined
        && release.collectionId !== options.expectedCollectionId) {
        return { ok: false, reason: 'release does not use the frozen collection' };
      }

      previous = active;
      active = release;
      return { ok: true, active };
    },
    async rollback() {
      if (!previous) return { ok: false, reason: 'no previous release to roll back to' };
      active = previous;
      previous = undefined;
      return { ok: true, active };
    },
  };
}

// ── Slice 0 coordinator ────────────────────────────────────────────────────

export interface FakeSliceInput {
  readonly examples: readonly TrainingExampleV1[];
  readonly task: EvaluationTaskV1;
  readonly digest: CanonicalDigest;
  readonly issuerId: string;
  readonly trainerId: string;
  readonly evaluator: FakeEvaluator;
  readonly pointer: InMemoryReleasePointer;
  readonly baseModel: TrainingArtifactRef;
  readonly config: TrainingArtifactRef;
  readonly activeRef: string;
  readonly baselineRef: string;
}

export interface FakeSliceResult {
  readonly collection: TrainingCollectionV1;
  readonly run: TrainingRunDescriptorV1;
  readonly terminal: TrainingRunTerminalV1;
  readonly report: EvaluationReportV1;
  readonly release: ModelReleaseDescriptorV1;
  readonly promotion: PromotionResult;
}

/**
 * A deterministic, no-GPU vertical slice: freeze a collection, run a fake
 * trainer, independently evaluate the candidate, and promote only if every
 * evidence check passes.
 */
export async function runFakeTrainingSlice(input: FakeSliceInput): Promise<FakeSliceResult> {
  const source = createSyntheticExampleSource(input.examples, input.digest);
  const trainSnapshot = await source.snapshot({ split: 'train' });
  const test = await source.snapshot({ split: 'test' });
  const trainExamples = await Promise.all(trainSnapshot.exampleIds.map((id) => source.resolve(id)));

  // Labels that are disputed, unknown, unsafe or restricted never enter the
  // training split; they are recorded as immutable exclusions.
  const eligibleTrain = trainExamples.filter((entry) => isTrainingEligible(entry.example));
  const ineligibleTrain = trainExamples.filter((entry) => !isTrainingEligible(entry.example));
  const excluded = [
    ...input.examples.filter((e) => e.split === 'excluded').map((e) => e.exampleId),
    ...ineligibleTrain.map((entry) => entry.example.exampleId),
  ];

  const splitExampleIds: Record<TrainingSplit, readonly string[]> = {
    train: eligibleTrain.map((entry) => entry.example.exampleId),
    validation: [],
    test: test.exampleIds,
    excluded,
  };
  const exampleIds = [...new Set([
    ...splitExampleIds.train,
    ...splitExampleIds.validation,
    ...splitExampleIds.test,
    ...splitExampleIds.excluded,
  ])].sort();
  const splitCommitments = computeSplitCommitments(splitExampleIds, input.digest);

  const collection = sealTrainingCollection({
    schema: 'totem:training:collection/v1',
    exampleRoot: computeExampleRoot(exampleIds, input.digest),
    exampleIds,
    splitExampleIds,
    selectionRuleDigest: input.digest('TOTEM_TRAINING_SELECTION_RULE_V1', 'slice0'),
    sourceSnapshot: {
      journalRanges: ['slice0:train', 'slice0:test'],
      commitments: [trainSnapshot.snapshotId, test.snapshotId],
      from: 0,
      to: 1_000,
    },
    splitCommitments,
    splitPolicy: {
      grouping: 'none',
      temporalIsolation: true,
      benchmarkFreshness: 'single-use',
    },
    exclusions: ineligibleTrain.map((entry) => ({
      exampleId: entry.example.exampleId,
      reason: 'ineligible label/rights',
    })),
    rightsPolicyRef: {
      namespace: 'training/rights',
      algorithm: 'sha3-256',
      digest: input.digest('TOTEM_TRAINING_RIGHTS_V1', 'slice0'),
    },
    qualityReport: {
      classCounts: input.examples.reduce<Record<string, number>>((counts, e) => {
        counts[e.outcome] = (counts[e.outcome] ?? 0) + 1;
        return counts;
      }, {}),
      modalities: input.examples.reduce<Record<string, number>>((counts, e) => {
        for (const i of e.inputs) counts[i.modality] = (counts[i.modality] ?? 0) + 1;
        return counts;
      }, {}),
      duplicateCount: 0,
      missingLabels: input.examples.filter((e) => e.outcome === 'unknown').length,
      contradictoryLabels: input.examples.filter((e) => e.labelDisagreement !== undefined).length,
    },
    holdoutPrecommit: {
      commitment: splitCommitments.test,
      committedAt: 0,
      policyDigest: input.digest('TOTEM_TRAINING_HOLDOUT_POLICY_V1', 'slice0'),
    },
    composerRef: input.issuerId,
    createdAt: 1_000,
  }, input.digest);

  if (input.task.heldOutCommitment !== collection.splitCommitments.test) {
    throw new Error('training: evaluation task was not precommitted to this collection test split');
  }
  assertValidTrainingCollection(collection, input.digest);

  const run = sealTrainingRunDescriptor({
    schema: 'totem:training:run-descriptor/v1',
    baseModel: input.baseModel,
    collectionId: collection.collectionId,
    collectionDigest: collection.collectionId,
    trainingSplit: 'train',
    taskId: input.task.taskId,
    codeDigest: input.digest('TOTEM_TRAINING_CODE_V1', 'slice0'),
    environmentDigest: input.digest('TOTEM_TRAINING_ENV_V1', 'slice0'),
    providerId: 'fake-trainer',
    providerVersion: 'slice0',
    hyperparameters: { epochs: 1, learningRate: 0.01 },
    seeds: [7],
    resourceEnvelope: { cpuSeconds: '10' },
    outputPolicy: 'candidate-only',
    rightsRefs: [collection.rightsPolicyRef.digest],
    preparedCommandDigest: input.digest('TOTEM_TRAINING_PREPARED_V1', 'slice0'),
    createdAt: 2_000,
  }, input.digest);

  const trainer = createFakeTrainer({ digest: input.digest });
  const prepared = await trainer.port.prepare({
    runId: run.runId,
    baseModel: run.baseModel,
    collectionId: collection.collectionId,
    trainingExampleIds: splitExampleIds.train,
    hyperparameters: run.hyperparameters,
    seeds: run.seeds,
    outputPolicy: run.outputPolicy,
  });
  const started = await trainer.port.start(prepared, 'slice0-idempotency');
  if (started.status !== 'accepted') throw new Error(`training: fake start rejected: ${started.reason}`);
  const observation = await trainer.port.inspect(started.jobRef);
  if (observation.status !== 'confirmed' || !observation.adapterRef) {
    throw new Error(`training: fake training did not confirm (${observation.status})`);
  }

  const testExamples = await Promise.all(test.exampleIds.map((id) => source.resolve(id)));
  const report = await input.evaluator.evaluate({
    task: input.task,
    candidateRef: observation.adapterRef.digest,
    activeRef: input.activeRef,
    baselineRef: input.baselineRef,
    heldOutExamples: testExamples.map((r) => r.example),
  });

  const release = sealModelRelease({
    schema: 'totem:training:model-release/v1',
    issuerId: input.issuerId,
    trainerId: input.trainerId,
    baseModel: run.baseModel,
    adapter: observation.adapterRef,
    config: input.config,
    trainingRunId: run.runId,
    collectionId: collection.collectionId,
    evaluationReportIds: [report.reportId],
    evaluationClassification: report.evaluatorId === input.trainerId ? 'self-evaluated' : 'independent',
    capabilities: ['task:slice0'],
    limitations: ['fake trainer; no model-quality claim'],
    hardware: ['cpu'],
    permittedUses: ['test-only'],
    approval: {
      decisionId: input.digest('TOTEM_TRAINING_APPROVAL_V1', report.reportId),
      approvedBy: input.issuerId,
      approvedAt: 5_000,
      evaluationReportId: report.reportId,
    },
    issuedAt: 5_000,
  }, input.digest);

  const terminal: TrainingRunTerminalV1 = {
    schema: 'totem:training:run-terminal/v1',
    runId: run.runId,
    status: 'confirmed',
    adapterRef: observation.adapterRef,
    completedAt: 3_000,
  };

  const promotion = await input.pointer.promote(release, report, {
    expectedHeldOutCommitment: collection.splitCommitments.test,
    expectedCollectionId: collection.collectionId,
  });

  return { collection, run, terminal, report, release, promotion };
}

/** Re-exported for tests that need only the eligibility rule. */
export { isTrainingEligible };
