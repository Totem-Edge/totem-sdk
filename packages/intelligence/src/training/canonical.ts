/**
 * Canonical encodings and commitments for RFC-077 Slice 0.
 *
 * The digest is an injected port so the contracts stay dependency-free and the
 * host can reuse the SDK's canonical hashing implementation.
 */

import type {
  EvaluationReportV1,
  ModelReleaseDescriptorV1,
  TrainingCollectionV1,
  TrainingExampleV1,
  TrainingRunDescriptorV1,
  TrainingSplit,
} from './types.js';

export type CanonicalDigest = (domain: string, canonicalBody: string) => string;

const DOMAIN_EXAMPLE = 'TOTEM_TRAINING_EXAMPLE_V1';
const DOMAIN_COLLECTION = 'TOTEM_TRAINING_COLLECTION_V1';
const DOMAIN_RUN = 'TOTEM_TRAINING_RUN_DESCRIPTOR_V1';
const DOMAIN_EVALUATION = 'TOTEM_TRAINING_EVALUATION_REPORT_V1';
const DOMAIN_RELEASE = 'TOTEM_TRAINING_MODEL_RELEASE_V1';
const DOMAIN_LEAF = 'TOTEM_TRAINING_LEAF_V1';
const DOMAIN_NODE = 'TOTEM_TRAINING_NODE_V1';
const DOMAIN_EMPTY = 'TOTEM_TRAINING_EMPTY_V1';

/** Deterministic JSON with sorted object keys and explicit nulls. */
export function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'bigint') return JSON.stringify({ __bigint: value.toString() });
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  const object = value as Record<string, unknown>;
  return '{' + Object.keys(object).sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
    .join(',') + '}';
}

export function computeExampleId(
  example: Omit<TrainingExampleV1, 'exampleId'> | TrainingExampleV1,
  digest: CanonicalDigest,
): string {
  const { exampleId: _ignored, ...body } = example as TrainingExampleV1;
  return digest(DOMAIN_EXAMPLE, canonicalJson(body));
}

export function sealTrainingExample(
  example: Omit<TrainingExampleV1, 'exampleId'>,
  digest: CanonicalDigest,
): TrainingExampleV1 {
  return { ...example, exampleId: computeExampleId(example, digest) };
}

export function computeExampleRoot(exampleIds: readonly string[], digest: CanonicalDigest): string {
  if (exampleIds.length === 0) return digest(DOMAIN_EMPTY, '');
  const unique = [...new Set(exampleIds)];
  if (unique.length !== exampleIds.length) {
    throw new Error('training: duplicate example id in commitment');
  }
  let level = unique.sort().map((id) => digest(DOMAIN_LEAF, id));
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      if (i + 1 === level.length) {
        next.push(level[i]);
      } else {
        next.push(digest(DOMAIN_NODE, level[i] + level[i + 1]));
      }
    }
    level = next;
  }
  return level[0];
}

export function computeSplitCommitments(
  splitExampleIds: Readonly<Record<TrainingSplit, readonly string[]>>,
  digest: CanonicalDigest,
): Readonly<Record<TrainingSplit, string>> {
  return {
    train: computeExampleRoot(splitExampleIds.train, digest),
    validation: computeExampleRoot(splitExampleIds.validation, digest),
    test: computeExampleRoot(splitExampleIds.test, digest),
    excluded: computeExampleRoot(splitExampleIds.excluded, digest),
  };
}

export function computeCollectionId(
  collection: Omit<TrainingCollectionV1, 'collectionId'> | TrainingCollectionV1,
  digest: CanonicalDigest,
): string {
  const { collectionId: _ignored, ...body } = collection as TrainingCollectionV1;
  return digest(DOMAIN_COLLECTION, canonicalJson(body));
}

export function sealTrainingCollection(
  collection: Omit<TrainingCollectionV1, 'collectionId'>,
  digest: CanonicalDigest,
): TrainingCollectionV1 {
  return { ...collection, collectionId: computeCollectionId(collection, digest) };
}

export function computeRunDescriptorId(
  descriptor: Omit<TrainingRunDescriptorV1, 'runId'> | TrainingRunDescriptorV1,
  digest: CanonicalDigest,
): string {
  const { runId: _ignored, ...body } = descriptor as TrainingRunDescriptorV1;
  return digest(DOMAIN_RUN, canonicalJson(body));
}

export function sealTrainingRunDescriptor(
  descriptor: Omit<TrainingRunDescriptorV1, 'runId'>,
  digest: CanonicalDigest,
): TrainingRunDescriptorV1 {
  return { ...descriptor, runId: computeRunDescriptorId(descriptor, digest) };
}

export function computeEvaluationReportId(
  report: Omit<EvaluationReportV1, 'reportId'> | EvaluationReportV1,
  digest: CanonicalDigest,
): string {
  const { reportId: _ignored, ...body } = report as EvaluationReportV1;
  return digest(DOMAIN_EVALUATION, canonicalJson(body));
}

export function sealEvaluationReport(
  report: Omit<EvaluationReportV1, 'reportId'>,
  digest: CanonicalDigest,
): EvaluationReportV1 {
  return { ...report, reportId: computeEvaluationReportId(report, digest) };
}

export function computeReleaseId(
  release: Omit<ModelReleaseDescriptorV1, 'releaseId'> | ModelReleaseDescriptorV1,
  digest: CanonicalDigest,
): string {
  const { releaseId: _ignored, ...body } = release as ModelReleaseDescriptorV1;
  return digest(DOMAIN_RELEASE, canonicalJson(body));
}

export function sealModelRelease(
  release: Omit<ModelReleaseDescriptorV1, 'releaseId'>,
  digest: CanonicalDigest,
): ModelReleaseDescriptorV1 {
  return { ...release, releaseId: computeReleaseId(release, digest) };
}

/** An example is eligible only when its label and rights are usable. */
export function isTrainingEligible(example: TrainingExampleV1): boolean {
  if (example.split !== 'train') return false;
  if (example.outcome !== 'success' && example.outcome !== 'failure') return false;
  if (example.redaction.status === 'restricted') return false;
  const unresolvedDispute = example.label.epistemicStatus === 'disputed'
    && example.labelDisagreement?.resolutionRef === undefined;
  if (unresolvedDispute) return false;
  if (example.labelDisagreement !== undefined && example.labelDisagreement.resolutionRef === undefined) return false;
  return true;
}

export function assertValidTrainingExample(example: TrainingExampleV1, digest: CanonicalDigest): void {
  if (example.schema !== 'totem:training:example/v1') {
    throw new Error(`training: unsupported example schema ${String(example.schema)}`);
  }
  if (example.exampleId !== computeExampleId(example, digest)) {
    throw new Error(`training: example ${example.exampleId} does not match its canonical body`);
  }
  if (example.inputs.length === 0) throw new Error('training: example has no inputs');
  if (example.target.artifactRef.digest.length === 0) throw new Error('training: example target has no digest');
  if (example.label.confidence !== undefined && !/^(0|1)(\.[0-9]+)?$/.test(example.label.confidence)) {
    throw new Error('training: label confidence must be a decimal in [0,1]');
  }
}

export function assertValidTrainingCollection(
  collection: TrainingCollectionV1,
  digest: CanonicalDigest,
): void {
  if (collection.schema !== 'totem:training:collection/v1') {
    throw new Error(`training: unsupported collection schema ${String(collection.schema)}`);
  }
  if (collection.collectionId !== computeCollectionId(collection, digest)) {
    throw new Error(`training: collection ${collection.collectionId} does not match its canonical body`);
  }
  if (collection.exampleRoot !== computeExampleRoot(collection.exampleIds, digest)) {
    throw new Error('training: collection example root does not match its membership');
  }
  const allSplits = (['train', 'validation', 'test', 'excluded'] as const);
  const seen = new Set<string>();
  for (const split of allSplits) {
    const ids = collection.splitExampleIds[split];
    for (const id of ids) {
      if (seen.has(id)) throw new Error(`training: example ${id} appears in more than one split`);
      seen.add(id);
      if (!collection.exampleIds.includes(id)) {
        throw new Error(`training: split example ${id} is not in the collection`);
      }
    }
    const expected = computeExampleRoot(ids, digest);
    if (collection.splitCommitments[split] !== expected) {
      throw new Error(`training: ${split} split commitment does not match its membership`);
    }
  }
  if (collection.holdoutPrecommit.commitment !== collection.splitCommitments.test) {
    throw new Error('training: held-out precommit does not match the test split');
  }
}

export function assertValidEvaluationReport(report: EvaluationReportV1, digest: CanonicalDigest): void {
  if (report.schema !== 'totem:training:evaluation-report/v1') {
    throw new Error(`training: unsupported evaluation schema ${String(report.schema)}`);
  }
  if (report.reportId !== computeEvaluationReportId(report, digest)) {
    throw new Error(`training: evaluation report ${report.reportId} does not match its canonical body`);
  }
  if (!report.evaluatorId) throw new Error('training: evaluation report has no evaluator');
  if (!report.heldOutCommitment) throw new Error('training: evaluation report has no held-out commitment');
}

export function assertValidModelRelease(release: ModelReleaseDescriptorV1, digest: CanonicalDigest): void {
  if (release.schema !== 'totem:training:model-release/v1') {
    throw new Error(`training: unsupported release schema ${String(release.schema)}`);
  }
  if (release.releaseId !== computeReleaseId(release, digest)) {
    throw new Error(`training: release ${release.releaseId} does not match its canonical body`);
  }
  if (release.evaluationReportIds.length === 0) {
    throw new Error('training: release has no evaluation report');
  }
  if (!release.evaluationReportIds.includes(release.approval.evaluationReportId)) {
    throw new Error('training: approval is not bound to a listed evaluation report');
  }
}
