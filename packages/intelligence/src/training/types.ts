/**
 * @totemsdk/intelligence/training — RFC-077 Slice 0 contracts.
 *
 * Provider-neutral, source-neutral records for verifiable adaptive learning.
 * These types deliberately do not import `agent-policy`, `edge`, `act-core`,
 * QVAC or Experience. Canonical digests are supplied by the caller so this
 * package remains dependency-free.
 */

/** Structural mirror of `@totemsdk/storage`'s `ArtifactRef`. */
export interface TrainingArtifactRef {
  readonly namespace: string;
  readonly algorithm: 'sha3-256';
  readonly digest: string;
}

export type TrainingSplit = 'train' | 'validation' | 'test' | 'excluded';

export interface TrainingExampleInput {
  readonly modality: string;
  readonly artifactRef: TrainingArtifactRef;
  readonly mediaType: string;
  readonly encoding: string;
  readonly shape?: readonly string[];
  readonly units?: string;
  readonly clock?: {
    readonly clockId: string;
    readonly fromTicks: string;
    readonly toTicks: string;
    readonly uncertaintyNs?: string;
  };
  readonly calibrationRef?: TrainingArtifactRef;
}

export interface TrainingExampleV1 {
  readonly schema: 'totem:training:example/v1';
  readonly exampleId: string;
  readonly task: {
    readonly taskId: string;
    readonly schemaRef: TrainingArtifactRef;
    readonly schemaVersion: string;
  };
  readonly sourceRefs: readonly string[];
  readonly inputs: readonly TrainingExampleInput[];
  readonly target: {
    readonly kind: 'text' | 'class' | 'action' | 'trajectory';
    readonly artifactRef: TrainingArtifactRef;
  };
  readonly label: {
    readonly sourceRef: string;
    readonly epistemicStatus: 'observed' | 'inferred' | 'verified' | 'disputed';
    readonly confidence?: string;
  };
  readonly outcome: 'success' | 'failure' | 'unknown' | 'unsafe';
  readonly outcomeEvidenceRefs: readonly string[];
  readonly supportingEvidenceRefs: readonly string[];
  readonly counterEvidenceRefs: readonly string[];
  readonly labelDisagreement?: {
    readonly conflictingLabelRefs: readonly string[];
    readonly resolutionRef?: string;
  };
  readonly transformDigest: string;
  readonly rightsRef: TrainingArtifactRef;
  readonly redaction: {
    readonly status: 'none' | 'redacted' | 'restricted' | 'unknown';
    readonly policyRef?: TrainingArtifactRef;
  };
  readonly attestationRefs?: readonly string[];
  readonly qualityFlags: readonly string[];
  readonly split: TrainingSplit;
}

export interface TrainingCollectionV1 {
  readonly schema: 'totem:training:collection/v1';
  readonly collectionId: string;
  readonly exampleRoot: string;
  readonly exampleIds: readonly string[];
  readonly splitExampleIds: Readonly<Record<TrainingSplit, readonly string[]>>;
  readonly selectionRuleDigest: string;
  readonly sourceSnapshot: {
    readonly journalRanges: readonly string[];
    readonly commitments: readonly string[];
    readonly from: number;
    readonly to: number;
  };
  readonly splitCommitments: Readonly<Record<TrainingSplit, string>>;
  readonly splitPolicy: {
    readonly grouping: 'none' | 'site' | 'device' | 'session';
    readonly temporalIsolation: boolean;
    readonly nearDuplicateThreshold?: string;
    readonly benchmarkFreshness: string;
  };
  readonly exclusions: readonly { readonly exampleId: string; readonly reason: string }[];
  readonly rightsPolicyRef: TrainingArtifactRef;
  readonly qualityReport: {
    readonly classCounts: Readonly<Record<string, number>>;
    readonly modalities: Readonly<Record<string, number>>;
    readonly duplicateCount: number;
    readonly missingLabels: number;
    readonly contradictoryLabels: number;
  };
  readonly holdoutPrecommit: {
    readonly commitment: string;
    readonly committedAt: number;
    readonly policyDigest: string;
  };
  readonly composerRef: string;
  readonly createdAt: number;
}

export interface SourceSelection {
  readonly split?: TrainingSplit;
  readonly limit?: number;
}

export interface SourceSnapshotRef {
  readonly snapshotId: string;
  readonly exampleIds: readonly string[];
}

export interface SourceExampleWithEvidence {
  readonly example: TrainingExampleV1;
  readonly evidenceRefs: readonly string[];
}

/** The only dependency the training pipeline has on a source system. */
export interface TrainingExampleSource {
  snapshot(query: SourceSelection): Promise<SourceSnapshotRef>;
  resolve(ref: string): Promise<SourceExampleWithEvidence>;
}

export interface TrainingRunDescriptorV1 {
  readonly schema: 'totem:training:run-descriptor/v1';
  readonly runId: string;
  readonly baseModel: TrainingArtifactRef;
  readonly collectionId: string;
  readonly collectionDigest: string;
  readonly trainingSplit: 'train';
  readonly taskId: string;
  readonly codeDigest: string;
  readonly containerDigest?: string;
  readonly environmentDigest: string;
  readonly providerId: string;
  readonly providerVersion: string;
  readonly hyperparameters: Readonly<Record<string, string | number | boolean>>;
  readonly seeds: readonly number[];
  readonly resourceEnvelope: Readonly<Record<string, string>>;
  readonly outputPolicy: string;
  readonly rightsRefs: readonly string[];
  readonly preparedCommandDigest: string;
  readonly createdAt: number;
}

export type TrainingRunStatus =
  | 'prepared'
  | 'reserved'
  | 'dispatched'
  | 'accepted'
  | 'running'
  | 'cancelling'
  | 'reconciling'
  | 'confirmed'
  | 'failed'
  | 'cancelled'
  | 'unknown';

export interface TrainingRunTerminalV1 {
  readonly schema: 'totem:training:run-terminal/v1';
  readonly runId: string;
  readonly status: Exclude<TrainingRunStatus, 'prepared' | 'reserved' | 'dispatched' | 'accepted' | 'running' | 'cancelling' | 'reconciling'>;
  readonly adapterRef?: TrainingArtifactRef;
  readonly actualConsumptionRef?: string;
  readonly diagnosticsRef?: string;
  readonly failure?: string;
  readonly completedAt: number;
}

export interface TrainingCapabilityReport {
  readonly providerId: string;
  readonly supports: readonly string[];
  readonly checkpointResume: boolean;
}

export interface TrainingRequest {
  readonly runId: string;
  readonly baseModel: TrainingArtifactRef;
  readonly collectionId: string;
  readonly trainingExampleIds: readonly string[];
  readonly hyperparameters: Readonly<Record<string, string | number | boolean>>;
  readonly seeds: readonly number[];
  readonly outputPolicy: string;
}

export interface PreparedTrainingJob {
  readonly runId: string;
  readonly providerId: string;
  readonly preparedCommandDigest: string;
  readonly request: TrainingRequest;
}

export type TrainingStartOutcome =
  | { readonly status: 'accepted'; readonly jobRef: string; readonly operationId: string }
  | { readonly status: 'rejected'; readonly reason: string };

export interface TrainingObservation {
  readonly status: 'accepted' | 'running' | 'confirmed' | 'failed' | 'cancelled' | 'unknown';
  readonly progress?: number;
  readonly adapterRef?: TrainingArtifactRef;
  readonly error?: string;
}

export interface TrainingCancelAcknowledgement {
  readonly acknowledged: boolean;
}

export interface TrainingProgressEvent {
  readonly status: 'accepted' | 'running' | 'confirmed' | 'failed' | 'cancelled' | 'unknown';
  readonly fraction?: number;
  readonly detail?: string;
}

/** Provider-neutral training port. QVAC is one implementation, not the owner. */
export interface TrainingPort {
  readonly providerId: string;
  capabilities(): Promise<TrainingCapabilityReport>;
  prepare(request: TrainingRequest): Promise<PreparedTrainingJob>;
  start(prepared: PreparedTrainingJob, idempotencyKey: string): Promise<TrainingStartOutcome>;
  inspect(jobRef: string): Promise<TrainingObservation>;
  cancel(jobRef: string): Promise<TrainingCancelAcknowledgement>;
  progress?(jobRef: string): AsyncIterable<TrainingProgressEvent>;
}

export interface EvaluationTaskV1 {
  readonly schema: 'totem:training:evaluation-task/v1';
  readonly taskId: string;
  readonly taskSchemaRef: TrainingArtifactRef;
  readonly inputDistribution: string;
  readonly targetMetric: string;
  readonly metrics: readonly string[];
  readonly safetySuites: readonly string[];
  readonly abstention: string;
  readonly sampleSize: number;
  readonly statistics: {
    readonly method: string;
    readonly confidence: string;
  };
  readonly thresholds: {
    readonly minScore: string;
    readonly maxRegression?: string;
    readonly safetyPass: boolean;
  };
  readonly heldOutCommitment: string;
  readonly harnessDigest: string;
  readonly baselineId: string;
  readonly createdAt: number;
}

export interface EvaluationReportV1 {
  readonly schema: 'totem:training:evaluation-report/v1';
  readonly reportId: string;
  readonly evaluatorId: string;
  readonly candidateReleaseId: string;
  readonly activeReleaseId: string;
  readonly naiveBaselineId: string;
  readonly heldOutCommitment: string;
  readonly taskId: string;
  readonly harnessDigest: string;
  readonly environmentDigest: string;
  readonly seedPolicy: string;
  readonly metrics: Readonly<Record<string, string>>;
  readonly safety: { readonly passed: boolean; readonly details: readonly string[] };
  readonly abstention: { readonly passed: boolean; readonly details: readonly string[] };
  readonly disposition: 'pass' | 'fail' | 'insufficient-evidence';
  readonly evidenceRefs: readonly string[];
  readonly evaluatedAt: number;
}

export type EvaluationClassification = 'independent' | 'self-evaluated';

export interface ModelReleaseDescriptorV1 {
  readonly schema: 'totem:training:model-release/v1';
  readonly releaseId: string;
  readonly issuerId: string;
  readonly trainerId: string;
  readonly baseModel: TrainingArtifactRef;
  readonly adapter: TrainingArtifactRef;
  readonly tokenizer?: TrainingArtifactRef;
  readonly config: TrainingArtifactRef;
  readonly trainingRunId: string;
  readonly collectionId: string;
  readonly evaluationReportIds: readonly string[];
  readonly evaluationClassification: EvaluationClassification;
  readonly capabilities: readonly string[];
  readonly limitations: readonly string[];
  readonly hardware: readonly string[];
  readonly permittedUses: readonly string[];
  readonly approval: {
    readonly decisionId: string;
    readonly approvedBy: string;
    readonly approvedAt: number;
    readonly evaluationReportId: string;
  };
  readonly previousReleaseId?: string;
  readonly rollbackTargetId?: string;
  readonly revocation?: {
    readonly revokedAt: number;
    readonly reason: string;
    readonly authorityId: string;
  } | null;
  readonly issuedAt: number;
}

/**
 * Boundary type only. Memory is a separate derived subsystem; Experience
 * records references to an exact revision, never a mutable current value.
 */
export interface MemoryRevisionV1 {
  readonly schema: 'totem:training:memory-revision/v1';
  readonly revisionRef: string;
  readonly memoryId: string;
  readonly kind: 'episodic' | 'semantic' | 'procedural' | 'model-native';
  readonly contentRef: TrainingArtifactRef;
  readonly sourceEpisodeRefs: readonly string[];
  readonly supersedes?: string;
  readonly validUntil?: number;
  readonly epistemicStatus: 'observed' | 'inferred' | 'verified' | 'disputed';
}
