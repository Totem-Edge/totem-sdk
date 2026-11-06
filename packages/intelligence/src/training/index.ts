/**
 * @totemsdk/intelligence/training — RFC-077 Slice 0 public surface.
 */

export type {
  TrainingArtifactRef,
  TrainingSplit,
  TrainingExampleInput,
  TrainingExampleV1,
  TrainingCollectionV1,
  SourceSelection,
  SourceSnapshotRef,
  SourceExampleWithEvidence,
  TrainingExampleSource,
  TrainingRunDescriptorV1,
  TrainingRunStatus,
  TrainingRunTerminalV1,
  TrainingCapabilityReport,
  TrainingRequest,
  PreparedTrainingJob,
  TrainingStartOutcome,
  TrainingObservation,
  TrainingCancelAcknowledgement,
  TrainingProgressEvent,
  TrainingPort,
  EvaluationTaskV1,
  EvaluationReportV1,
  EvaluationClassification,
  ModelReleaseDescriptorV1,
  MemoryRevisionV1,
} from './types.js';

export {
  canonicalJson,
  computeExampleId,
  sealTrainingExample,
  computeExampleRoot,
  computeSplitCommitments,
  computeCollectionId,
  sealTrainingCollection,
  computeRunDescriptorId,
  sealTrainingRunDescriptor,
  computeEvaluationReportId,
  sealEvaluationReport,
  computeReleaseId,
  sealModelRelease,
  isTrainingEligible,
  assertValidTrainingExample,
  assertValidTrainingCollection,
  assertValidEvaluationReport,
  assertValidModelRelease,
} from './canonical.js';
export type { CanonicalDigest } from './canonical.js';

export {
  createSyntheticExampleSource,
  createFakeTrainer,
  createFakeEvaluator,
  createInMemoryReleasePointer,
  runFakeTrainingSlice,
} from './fakes.js';
export type {
  FakeTrainerOptions,
  FakeTrainer,
  FakeEvaluatorOptions,
  FakeEvaluationInput,
  FakeEvaluator,
  PromotionOptions,
  PromotionResult,
  InMemoryReleasePointer,
  FakeSliceInput,
  FakeSliceResult,
} from './fakes.js';
