# RFC-077 — Verifiable Adaptive Intelligence Lifecycle

**Status:** Draft for architectural review — not implemented; no releaseability claim  
**Created:** 2026-11-05  
**Scope:** Contracts and compositional integration across `@totemsdk/intelligence`, `@totemsdk/edge`, `@totemsdk/agent-policy`, `@totemsdk/act-core`, `@totemsdk/qvac`, Storage, ProofGraph, and optional Experience  
**Prerequisite:** [RFC-022 Amendment A — Governed Async Settlement and Actual-Usage Accounting](RFC-022-AMENDMENT-A-GOVERNED-ASYNC-SETTLEMENT-AND-ACTUAL-USAGE.md) (see §3). This general SDK correction applies to existing `act-mavlink` and `act-ocpp` independently of RFC-077, and requires its own release and migration note.  
**Related:** RFC-006 (landed QVAC integration), RFC-007 (Storage), RFC-010/011/019/022/023 (governed action, durable operations and effects), RFC-047 (Experience, Phase-0-only), RFC-057 (Replication), RFC-076 (SunSpec evidence and bounded resources).

> **Baseline and truthfulness:** This draft uses source inspected on the repository's default branch on 2026-11-05. RFC-047 remains a Phase-0 research authorization; `@totemsdk/experience` is not a published or approved production package. `@totemsdk/qvac` exposes native `finetune` but does not currently implement a governed, independently evaluated model-release lifecycle. All types in this RFC are **proposals**, not existing APIs.

## 1. Decision

Totem SHALL support locally trained, verifiably attributable candidate model updates using six independent top-level records: **Experience Episode, Training Collection, Training Run, Evaluation Report, Model Release, and Memory Revision**. A **TrainingExample** is an additional first-class immutable *atom* referenced by Training Collections, not a substitute for any of the six records.

Two architecture decisions are final for this RFC:

1. **Training is a governed Act, not an agent-accessible raw intelligence invocation.** An agent initiates training via a registered `EdgeActionDefinition` whose prepared descriptor and resource effects are reviewed by `GrantBoundAutonomyPolicy`. The training adapter uses an `@totemsdk/intelligence`-owned, provider-neutral `TrainingPort`; QVAC is one implementation behind that port.
2. **Training Collection and TrainingExample are independent of Experience.** A `TrainingExampleSource` can read synthetic fixtures, Storage Journal + ArtifactStore, or a future RFC-047 Experience implementation. RFC-047 Phase 0 retains its explicit possibility of concluding that no production Experience package is justified.

A model is **not** approved merely because training completed, a file hash matched, or the trainer self-reported an improvement. Certification requires independent evaluation and a separately attributable authorization decision.

## 2. Goals, non-goals and threat model

### Goals

- End-to-end traceability: source evidence -> exact examples -> frozen collection -> training run -> candidate artifact -> independently attributable evaluation -> authorized release -> exact inference/action provenance.
- Provider-neutral API and source-neutral datasets; no QVAC or Experience dependency in core data contracts.
- Bounded, fail-closed, durable training with at-most-once dispatch semantics, explicit uncertainty, rights checks and deterministic revocation/rollback.
- A tiny **fake trainer + fake evaluator** conformance implementation before introducing native QVAC, GPU resources or an Experience package.
- Separate inference diagnostics (self-reported) from evaluation evidence (externally attributable and controlled).

### Non-goals

Machine unlearning; differential privacy; federated aggregation; secure multi-party training; universal model training support; general-purpose agent memory; a new generic ledger, crypto stack or graph database; a new Manifest wire discriminant; automatic assertion that any update improves safety; proof of the *absence* of undeclared/off-platform training; cryptographic proof of physical ground truth.

### Required threat model

**Adversaries and failure sources:** malicious or compromised data suppliers; source/label poisoning; backdoored adapter binaries; training-configuration substitution; dataset split leakage and evaluation gaming; benchmark reuse; compromised trainer or evaluator; forged provenance; content-access violations; hardware/worker crashes; lost cancellation ACKs; duplicate dispatch; stale/forged approval or revoked model releases; supply-chain attacks on base model, tokenizer, code, container, or runtime. Every stage SHALL specify its trusted principals, untrusted input fields, cryptographic commitments, failure outcomes and observable control points.

## 3. Blocking prerequisite — General asynchronous Act correctness and actual-use settlement

**Normative owner:** [RFC-022 Amendment A](RFC-022-AMENDMENT-A-GOVERNED-ASYNC-SETTLEMENT-AND-ACTUAL-USAGE.md), a separate formal change record linked to RFC-010/011/022. This subsection states the dependency RFC-077 relies on; it does **not** define a second accounting or operation lifecycle.

### 3.1 Confirmed defect and scope

`AgentEdgeRuntime.executeAction` currently uses `result.ok` to commit or abort authorization. `act-core` returns `ok:true, outcome:'accepted'` on async acceptance and `ok:false, errorCode:'OPERATION_PENDING'` on deduplicated pending work. Existing `act-mavlink` and `act-ocpp` async actions can therefore be prematurely settled. This is an existing Act correctness defect, **not** a problem introduced by model training.

The more fundamental issue is that `ReservationSettlementOutcome` is currently only `'completed' | 'definitely-not-executed'` and the grant-usage ledger cannot apply *actual* verified consumption. An operation that starts, consumes 40% of its authorization and fails must neither be falsely refunded as unexecuted nor charged 100% without an explicit conservative-accounting policy.

### 3.2 Mandatory execution result and settlement contract

The corrected governed `EdgeActionDefinition.execute` result SHALL express three separate facts:

1. `dispatchState: 'not-dispatched' | 'dispatched' | 'unknown'`;
2. `terminalOutcome: 'confirmed' | 'failed' | 'cancelled' | 'aborted' | 'unknown'` **or** nonterminal phase `accepted | running | cancelling | reconciling`;
3. optional **trusted actual-consumption evidence** for spend/fees, compute, duration and per-mandate usage, with measurement quality and immutable evidence references.

The corresponding `EdgeActionResult` exposes the operation and reservation identifiers, dispatch/terminal/phase disposition and an actual-accounting receipt or digest. `ok` alone MUST NOT drive settlement. Returned failures and throws pass through a qualified classifier. Existing synchronous actions without async metadata retain their historical behavior when truly non-ambiguous. Existing async behaviors are deliberately corrected.

| Dispatch / phase | Required ledger action |
|---|---|
| Proven not dispatched, failed/aborted or cancelled before dispatch | Release full reservation; record evidence of non-dispatch |
| Dispatched, accepted/running/cancelling | Hold reservation; no final charge or refund |
| Dispatched, confirmed | Settle verified actual; otherwise use only an explicitly approved conservative full-reserved charge |
| Dispatched, failed or cancelled after execution | **Settle verified actual, release unused reserved amount and record the failure/cancellation** |
| Dispatch unknown or terminal evidence incomplete | Hold for reconciliation; never presume non-execution |
| Duplicate `OPERATION_PENDING` | Retain original reservation and operation ID; do not reserve or execute again |

**Mandatory ledger vector:** reserve 1,000 accelerator seconds; independently verified terminal failed job consumed 400. Final ledger is `committed=400`, `held=0`, `released=600`, `available=600`, with executed-attempt count one and a terminal failed receipt. If actual use is not verifiable, the missing measurement is **not** zero; retain a hold or apply a preauthorized conservative full-bound policy. All mandate-usage rows and run totals must agree. Replaying the identical settlement must not change any total.

The authority layer SHALL add a canonical `settleActual` / `settleReservation` operation with durable actual-consumption receipt, atomic run + per-mandate usage updates, idempotent `settlementId` and conflict detection. `GrantUsageStore.commit` and the existing `reconcileReservation('completed'|'definitely-not-executed')` cannot serve as this primitive without augmentation. Receipt-only re-snapshotting is not enough.

### 3.3 Long-lived leases and recovery

The current initial reservation TTL is 60 seconds. Training needs a policy-limited renew-before deadline, trusted lease owner/fencing and finite absolute maximum. A heartbeat proves coordinator liveness, not execution outcome. An expired unsettled reservation becomes `unknown` with budget **held**; **do not call `commit()` after expiry**. Upon authenticated terminal evidence use the reconciliation/actual-settlement path, even if the reservation is past TTL. If the outcome remains uncertain beyond the bounded reconciliation window, hold it for explicit operator reconciliation; never automatically release or redispatch.

Cancellation follows `accepted -> running -> cancelling -> cancelled | confirmed | failed | unknown`. A cancellation request is nonterminal. The evidence hierarchy must not equate absent logs, a stopped process or a missing checkpoint with definite non-execution. Unknown operational status must remain reconcilable even if an existing store represents `unknown` as a terminal status.

### 3.4 Prepared-command binding and dependencies

The canonical authorized action MUST bind the immutable prepared training descriptor digest, resource envelope, run/step identity and reservation, with a versioned digest that does not silently alter existing signed semantics. The existing reservation `actionDigest` currently stores a nonce; that is **not** proof that the prepared command was committed. Correlate operation and reservation durably before external dispatch, without assuming independent stores share atomic transactions.

No training job is agent-reachable until Amendment A passes its regression matrix. That matrix includes legacy sync compatibility; `ok:true + accepted` hold; `OPERATION_PENDING` hold; known-executed failed and cancelled *partial* settlement; lease expiry and later reconciliation; crash/restart; duplicate replay; and all existing `act-mavlink` mission and `act-ocpp` session actions. **Tests must assert committed, held, released and per-mandate amounts, not only return codes.**

## 4. Package boundaries and dependency rules

| Owner | Contract / responsibility |
|---|---|
| `@totemsdk/intelligence/training` (proposed subpath) | `TrainingExample`, `TrainingCollection`, `TrainingRunDescriptor`, `TrainingPort`, `EvaluationTask`, `EvaluationReport`, `ModelReleaseDescriptor` and neutral refs; may depend on `@totemsdk/storage` for `ArtifactRef`, **never** on `agent-policy`, `edge`, `act-core`, QVAC or Experience |
| `@totemsdk/agent-policy` | Typed `ComputeEffects` in `StepEffects`, `RunLimits.compute`, enforceable ceilings and usage reservation/reconciliation; it already depends on `intelligence`, so reverse dependency is prohibited |
| `@totemsdk/edge` | Governed action dispatch, operation-specific capabilities, truthful async outcome and durable reservation context; separate hardening for simple `createEdgeRuntime` |
| `@totemsdk/act-core` | Reuse `DeviceOperationStore`, `FailureMode`, `OperationLifecycle`, `AsyncOperationSupport` as far as compatible; extract a neutral core **only** if demonstrated necessary, preserving device adapters |
| `@totemsdk/act-training` (new narrow adapter) | Prepare/validate training act; derive effects; bind to provider-neutral `TrainingPort`; bridge durable operation and reservation lifecycle; **no QVAC dependency** |
| `@totemsdk/qvac` | Concrete `TrainingPort` adapter; native fine-tuning, request IDs, progress, cancellation, artifact export; no independent authority or source history |
| `@totemsdk/storage` / `proofgraph` | Journal, CAS, immutable content-addressed bytes, existing relationship vocabulary; no replacement engines |
| `@totemsdk/identity` / `proof` / `wots-lease` | Issuer/evaluator identity, attestations and signing-key budget |
| `@totemsdk/manifest` | **No fifth Manifest type in this RFC.** Existing `EdgeServiceManifest` MAY advertise a release descriptor reference; it is not the release itself |
| `@totemsdk/replication` / `replication-holepunch` | Optional authorized artifact transport. Replication `DatasetDescriptor` is a replication envelope, **not** a training dataset manifest |
| RFC-047 Experience implementation, if ever approved | Optional `TrainingExampleSource`, with no reverse dependency |
| Future memory subsystem | Separate, revisioned mutable beliefs; references exact model/episode inputs without editing immutable Episode records |

`TrainingPort` and `TrainingExampleSource` MUST be structural, provider-neutral ports. Training evidence and evaluation independence must work unchanged with a fake trainer.

### 4.1 Capabilities and both Edge policy paths

Agent-facing `train:start` (exact action naming fixed in implementation) is a registered governed action requiring `intelligence:llm:finetune`, not `intelligence:llm`. `hasIntelligenceOperationCapability(set, domain, op)` MUST check the required operation explicitly: the domain-level capability SHALL NOT imply permission to train. `EDGE_INTELLIGENCE_CAPABILITIES` continues to enumerate domain capabilities; operation capabilities are a distinct supported catalog. Inference permissions must not expand by wildcard parsing.

**Two entry points, two required protections:**

1. **AgentEdgeRuntime:** use `EdgeActionDefinition` + `GrantBoundAutonomyPolicy.authorizeAndReserve`, immutable prepared-command binding and computed effects.
2. **Simple `createEdgeRuntime` / `intelligence:invoke`:** keep provider-compatible dispatch but validate `(domain, op)` and check an operation-scoped capability. `EdgePolicyPort.check` presently receives `{ action, subject, context, proposal? }`, not `payload.domain/op`. Extend it with a **runtime-derived sanitized operation descriptor** when necessary; caller-supplied context never constitutes authority. Alternatively, reject all mutating/training operations from this simpler path unless a trusted host explicitly enables a governed bridge. Tests SHALL prove there is no bypass.

Direct QVAC/provider interfaces are privileged host APIs, not agent-facing grants. Internal APIs are not security boundaries by themselves; the host MUST keep provider access out of untrusted agents' reach.

## 5. First-class TrainingExample contract

The following is **illustrative**: fields, casing, codecs and hash vectors become normative at G0, prior to implementation.

```ts
interface TrainingExampleV1 {
  schema: 'totem:training:example/v1';
  exampleId: string;                  // domain-separated digest of canonical body sans ID
  task: { taskId: string; schemaRef: ArtifactRef; schemaVersion: string };
  sourceRefs: readonly string[];      // immutable episode/journal/source commitments
  inputs: readonly {
    modality: string;                  // e.g. text/rgb/depth/imu/telemetry
    artifactRef: ArtifactRef;
    mediaType: string;
    encoding: string;
    shape?: readonly string[];        // exact dimension strings
    units?: string;
    clock?: { clockId: string; fromTicks: string; toTicks: string; uncertaintyNs?: string };
    calibrationRef?: ArtifactRef;
  }[];
  target: { kind: 'text' | 'class' | 'action' | 'trajectory'; artifactRef: ArtifactRef };
  label: {
    sourceRef: string;
    epistemicStatus: 'observed' | 'inferred' | 'verified' | 'disputed';
    confidence?: string;              // canonical decimal; NOT an implied probability
  };
  outcome: 'success' | 'failure' | 'unknown' | 'unsafe';
  outcomeEvidenceRefs: readonly string[];
  supportingEvidenceRefs: readonly string[];
  counterEvidenceRefs: readonly string[];
  labelDisagreement?: {
    conflictingLabelRefs: readonly string[];
    resolutionRef?: string;
  };
  transformDigest: string;            // exact preprocessing implementation/config
  rightsRef: ArtifactRef;
  redaction: { status: 'none' | 'redacted' | 'restricted' | 'unknown'; policyRef?: ArtifactRef };
  attestationRefs?: readonly string[];
  qualityFlags: readonly string[];
  split: 'train' | 'validation' | 'test' | 'excluded';
}
```

Example IDs bind the split; reassigning an example creates a new immutable example record and must still pass cross-collection leakage checks on underlying source/artifact fingerprints. Every referenced artifact SHALL be digest verified. `unknown`, disputed, incomplete or unsafe examples SHALL not silently be labelled success. Unknown required fields or unrecognized semantic enum values FAIL CLOSED at this schema version; explicitly versioned namespaced extensions can be added by a successor schema. Canonical encoding uses Totem's established codec/canonical hash with a distinct `totem:training:example/v1` domain separator; unknown-field handling and test vectors are part of G0.

### 5.1 Outcome disagreement vector

Fixture: motor controller reports pickup success; independent camera evidence shows object dropped. Preserve both claims and evidence, mark `labelDisagreement`, and fail quality eligibility (or mark `disputed`/`excluded`) until an attributable resolution occurs. A device's own success receipt is not automatically a verified ground-truth label.

## 6. Immutable Training Collection and split protocol

The collection body SHALL include:

- `collectionId`, schema/canonicalization version, ordered example refs **or** deterministic Merkle root (define sorting, duplicates and proofs), and source-snapshot journal windows/commitments;
- selection-rule parameters **and selection code digest**; selection time and composer identity/attestation;
- train/validation/test/excluded membership commitments and immutable exclusion reasons;
- split policy: group-by-site/device/session, non-overlapping temporal windows, near-duplicate policy/thresholds, label/source contamination checks, and benchmark reuse/freshness policy;
- rights and consent/use-grant references, permitted purpose, retention policy, restricted-disclosure policy and provenance;
- quality/coverage report commitment: class and label distributions, modalities and coverage, missing/contradictory labels, duplicates, near-duplicates, exclusions, and source diversity;
- independent test-holdout precommit reference, with the exact precommit timestamp/event and policy/threshold digests.

### 6.1 Required ordering and entitlement

The **evaluation holder** SHALL commit the held-out selection, evaluation task/harness and pass thresholds **before the trainer selects the training examples or begins its training run**. This may be a separate sealed holdout commitment linked later into the complete collection. A committed public root must not disclose restricted test bytes.

The trainer obtains only allowed **train** and explicitly allowed **validation** refs, through a workspace/content gate scoped to those partitions. Held-out bytes are in an isolated ArtifactStore namespace controlled by evaluator-held credentials and, where appropriate, encrypted. Separation is enforced below any provider call, not solely by advisory conventions. No trainer-controlled path may export raw held-out examples. Evaluator raw outputs also require restricted access/redaction since outputs can leak test content or PII.

Time-series groups cannot be randomly split by adjacent samples. Site/device-level holdouts are required when generalization to unseen sites/devices is the evaluation claim. Hash duplicate and similarity checks are required across train, validation and test. Reusing a certification benchmark across multiple releases requires an explicit rotation/freshness policy, with exposure tracked and reported. Lack of coverage or leakage checks prevents independent certification.

The collection commitment attests to **declared membership**, not the absence of additional undisclosed model training.

## 7. Training Run and provider-neutral TrainingPort

### 7.1 Training run records

- **Immutable descriptor** created before dispatch: `runId`, base-model ID and digest, frozen collection digest, training partition refs, task contract, code/container digest, environment and dependency lock digests, provider ID and version, hyperparameters, determinism/seeds, accepted resource envelope, output policy, retention policy, rights checks, and prepared-command digest.
- **Append-only job status:** `prepared`, `reserved`, `dispatched`, `accepted`, `running`, `cancelling`, `reconciling`, `confirmed`, `failed`, `cancelled`, `unknown`; include event sequence, timestamps, authenticated source and reconciled worker/request identifier. `unknown` is a truthful unresolved *reporting* disposition but does **not** free a reservation, block later reconciliation, or authorize automatic retry. The existing `isTerminalOperationStatus()` handling of `unknown` must be reviewed and corrected if it prevents required reconciliation.
- **Immutable terminal record** separately commits output adapter digest/ref (if produced), actual metered resource use (or declared measurement gaps), diagnostics, failure/cancel evidence and references the immutable descriptor. Failed/cancelled/unknown are first-class outcomes; a run may produce no model artifact.

The run's output digest cannot be part of the original immutable prepared descriptor because it does not yet exist. Training diagnostics (loss curves, self-reported metrics) must not be represented as independent evaluation.

### 7.2 Port boundary

```ts
interface TrainingPort {
  readonly providerId: string;
  capabilities(): Promise<TrainingCapabilityReport>;
  prepare(request: TrainingRequest): Promise<PreparedTrainingJob>;
  start(prepared: PreparedTrainingJob, idempotencyKey: string): Promise<TrainingStartOutcome>;
  inspect(jobRef: string): Promise<TrainingObservation>;
  cancel(jobRef: string): Promise<TrainingCancelAcknowledgement>;
  progress?(jobRef: string): AsyncIterable<TrainingProgressEvent>;
  // No generic resume(): checkpoint recovery must be explicitly supported and versioned.
}

interface TrainingExampleSource {
  snapshot(query: SourceSelection): Promise<SourceSnapshotRef>;
  resolve(ref: SourceExampleRef): Promise<SourceExampleWithEvidence>;
}
```

These illustrative interfaces do not imply that a provider supports all methods: `inspect`, progress, cancellation and recovery capabilities SHALL be discovered truthfully; required missing features may block unattended jobs. A start result `accepted` means the provider accepted work, not completed training. Provider handles and request IDs must outlive initial `invoke` return until terminal reconciliation.

### 7.3 QVAC implementation scope

The initial QVAC adapter SHALL use `finetune`, its returned `progressStream`/`result` and `requestId`, and targeted `cancel` when supported. It must reconcile real upstream API and hardware compatibility, type the input and output surface, and preserve errors and progress. The vendored QVAC 0.19.0 type surface has **no verified checkpoint-resume training API**; `resume()` in its models domain is not proof of training-job continuation. Crash recovery is therefore **reconcile/fail/unknown**, and restart under a fresh ID is prohibited until definitely-not-executed is established. Checkpoint support is deferred to a separately verified upstream or proven provider contract.

## 8. Compute effects, leases and signing budgets

`StepEffects.compute` and `RunLimits.compute` belong in `agent-policy` (or a genuinely neutral effects-only module), never in `intelligence` importing `agent-policy`. Compute envelopes are **resources**, not financial costs. `StepEffects.spends`/`fees` remain the sole financial effects representation.

```ts
interface ComputeEffect {
  resourceId: string;                // approved named host/resource pool
  maxWallSeconds: string;
  maxCpuSeconds: string;
  maxAcceleratorSeconds?: string;     // GPU/NPU/TPU class, with declared class ID
  acceleratorClass?: string;
  maxMemoryBytes: string;             // peak resident allocation
  maxDiskBytes: string;
  maxNetworkBytes: string;
}

interface ComputeConsumption {
  resourceId: string;
  observedWallSeconds?: string;
  observedCpuSeconds?: string;
  observedAcceleratorSeconds?: string;
  observedPeakMemoryBytes?: string;
  observedDiskBytes?: string;
  observedNetworkBytes?: string;
  measurementStatus: 'measured' | 'estimated' | 'unknown';
  meteringEvidenceRefs: readonly string[];
}
```

Canonical quantities are non-negative base-10 integer strings in the indicated units, with explicit rounding and max-safe-range rules in the G0 vectors. The resource ID and accelerator class prevent a budget for one host or device class being misapplied to another. Time is seconds (not milliseconds) in committed effects; platform timestamps and lease deadlines are integer epoch milliseconds. Host enforcement needs appropriate worker limits/cgroups or OS/hardware measures; reporting a theoretical bound without enforcement is insufficient to claim a hard ceiling. Unavailable metering is recorded as `unknown`, never zero. Do not use a token cost as a substitute for compute limits.

Reserve worst-case authorized concurrent consumption and settle terminal **verified actuals** through RFC-022 Amendment A. The trusted `ComputeConsumption` measurement is an input to the shared `ActualConsumptionV1` accounting contract; it is not a second ledger. If 1,000 accelerator seconds are reserved and a failed job used 400, the shared authority must commit 400, release 600 and record the failure. No budget is released on an unknown job. Run totals and every linked grant-usage row must change together, with an idempotent settlement digest. Do not represent provider-reported progress as independently metered consumption.

**Signing budget:** estimate required attestation/receipt boundaries and reserve WOTS leases through the established key-use system. Do not sign every training step, sensor sample or token. If mandatory evidence signing cannot be completed under authorized signing budget, deny training start or promotion as applicable. A release cannot be approved or promoted without required signed evaluation and approval evidence. A signature verifies attribution/integrity, not model quality.

## 9. Independent Evaluation Task and Report

### 9.1 Evaluation Task

The evaluator SHALL use a sealed, versioned task contract specifying task/input distribution, expected labels, compatibility limits, target metrics and aggregation, sample size and statistical method, confidence/uncertainty, safety and abstention suites, performance/resource budgets, baseline rules, allowable missingness, contamination checks, and pass/fail thresholds. The task and held-out commitment are fixed before training-data selection (see §6.1).

### 9.2 Independence

A release labelled **independently certified** requires a distinct accountable evaluator identity and signing/attestation key, with authorization independent of the training principal, independently controlled test data, and a harness whose digest is not replaceable by the trainer. Mere different process IDs do not establish independence.

`self-evaluated` offline reports MAY exist but MUST NOT be relabelled independently certified. For certified release gates, missing evidence fails closed.

### 9.3 Report

The immutable report SHALL bind evaluator identity and signed attestation/proof reference, exact candidate and current active release digests, naive baseline ID, held-out root, task/harness/environment/version digests, seed policy, precommitted thresholds, sample sizes, raw-output commitments, metrics, confidence intervals, resource measurements, contamination/near-duplicate checks, safety/abstention outcomes and an explicit pass/fail/insufficient-evidence disposition.

Compare **candidate vs active release vs naive baseline on the same held-out set and harness**. Training loss is not evaluation evidence. Raw outputs stay in access-controlled/redacted artifacts, with digest commitments and rights-bound retention. Evaluation attestation and report digest MUST be inputs to the *authorization decision itself*, not attached only after a model release is created.

## 10. Model Release descriptor and verification

### 10.1 Explicit P0 decision: separate signed release descriptor

`@totemsdk/manifest` currently has a closed four-type union (`app`, `capability`, `dapp`, `edge-service`) and wire discriminants `0x01`–`0x04`. This RFC SHALL **not** add a fifth manifest family. Instead the release body is a separate domain-separated, versioned, immutable ArtifactStore object, signed/attested by existing Proof/Identity machinery; existing manifests MAY advertise the release digest through a compatible existing field or other existing discoverability channel, but MUST NOT pretend it is a native `SignedManifest` type. Any new discovery field must be separately checked for compatibility.

### 10.2 Required release body

- `schema: 'totem:model:release/v1'`; `releaseId` as digest of canonical body sans ID/signature; issuer identity and signer role;
- exact base-model, adapter, tokenizer and model/inference-config digests; compatible runtime/provider versions and hardware/device classes;
- Training Run terminal record, frozen Training Collection, Evaluation Reports and independent classification; declared capabilities, limitations, safety boundaries, permitted uses and deployment constraints;
- approval decision, mandate and signing/attestation proof references; *approval digest bound to evaluation report digest*;
- `previousReleaseId`, `supersedes`, rollback target, revocation reference/authority and declared revocation status snapshot; release-pointer update policy and audit information;
- schema/canonicalization version, issue time and expiry/refresh policy where applicable, with explicit availability/freshness semantics.

### 10.3 Remote verifier recipe (mandatory conformance)

1. Fetch immutable release descriptor and validate schema, canonical digest and issuer identity.
2. Verify issuer signature/attestation chain, key validity/lease requirements and authorization mandate.
3. Resolve and verify Training Run descriptor and terminal record, Training Collection root, provenance and rights eligibility.
4. Verify evaluator identity, key/status, signed Evaluation Report and harness/held-out commitments; enforce required independence and non-revocation.
5. Fetch and digest-verify base model, adapter, tokenizer and config; check provider, device, memory and runtime compatibility.
6. Resolve current revocations/quarantines, freshness conditions and deployment constraints. Fail closed on unknown required evidence.
7. Apply governed atomic active-release pointer change and retain a verified known-good rollback target; record the exact release used for subsequent inference and actions.

Verification of a content-addressed artifact proves **bytes**, not safe behaviour; a signed report proves attribution, not the evaluator's infallibility.

### 10.4 Revocation and rollback

States SHALL distinguish `candidate`, `shadow`, `canary`, `active`, `quarantined`, `revoked` and `superseded`. Promotion policies predeclare safety regression thresholds, functional deterioration, resource violations, missing evidence, canary rollback conditions and operator revocation. The deployment pointer update is durable, atomic and authority-bound; a failed promotion must not leave the pointer referring to an unverified candidate. Canary failure and revocation restore an approved compatible previous release or place inference in a defined safe/unavailable state, never an arbitrary fallback.

Revocation changes **future eligibility**; it does not retroactively erase historically valid attributed proofs/actions. Historical inference is flagged as originating from a now-revoked release. ProofGraph relationships (`derived_from`, `references`, `supports`, `revision_of`, `supersedes`, `revokes`, `contradicts`, `conflicts_with`) identify dependent collections/runs/releases for quarantine. This is **lineage tracing, not machine unlearning**. Affected artifacts may need withdrawal and retraining.

### 10.5 Inference-time provenance

Every governed model-produced action MUST bind the exact release ID, base/adapter/tokenizer digest (or the signed release's committed versions), relevant inference parameter digest, input evidence actually consumed, and available output/action artifact refs. RFC-047 model-action Episodes MAY reference these fields when Experience exists. Lack of evidence must be recorded as `unknown`/absent, not reconstructed from a mutable current-release pointer.

## 11. Data rights and restricted evidence

Rights are evaluated at source acceptance, collection freeze, trainer access, evaluation access, artifact export and release promotion. Record use purpose, data owner/controller authority, consent/licence or alternative lawful basis where applicable, disclosure constraints, retention/deletion expectations, permitted derivation and geographic/site restrictions where relevant. Redact personal/sensitive information before irreversible sharing wherever required. Neither a hash nor immutable Episode authorizes indefinite retention, training use or replication.

Quarantine must support per-example or per-source invalidation and dependency traversal. Content-addressed bytes can be deleted or withheld while historical digests/tombstones remain, subject to applicable law and policy; do not promise simultaneous indefinite immutable availability and unqualified deletion rights. Confirmed revocation does not remove contributions already encoded into weights. Quarantine downstream model releases, and require appropriate withdrawal/retraining decisions.

## 12. Walking-skeleton delivery and conformance

**Prerequisite A — RFC-022 Amendment A (separate formal PR/release):** dispatch/terminal/actual-consumption result model; atomic `settleActual` at run-state and grant-usage levels; renew/reconcile after TTL; returned-failure classification, trusted reservation-to-operation correlation, and ledger-asserting regressions across existing MAVLink/OCPP async definitions. No dependence on QVAC or RFC-077. Publish in dependency order (`agent-policy` → `edge` → `act-core` → `act-mavlink`/`act-ocpp`), honoring `check-upstream-published` and updating qualification registry, public docs and consumer migration notes.

**G0 — Contract freeze and vectors:** ratify six records plus TrainingExample atom, separate signed-release descriptor, TrainingPort and TrainingExampleSource, canonical version/hash vectors, task contract, policy actions, resource effects and trust model. Verify all package dependency directions remain acyclic.

**Slice 0 — Zero-GPU fake trainer/evaluator:** synthetic journal/artifact examples, fake clock, fake lease/signing budget, deterministic fake trainer, evaluator with separately controlled sealed held-out fixture, persisted active-release pointer, and a forced rollback. No QVAC, Experience or native AI runtime. Reuse Amendment A regression fixtures and assert partial executed-failure accounting (1,000 reserved, 400 actual, 600 released), post-expiry reconciliation, SQLite/memory ledger parity, no duplicate reservation and no premature acceptance commit. Tests must prove denials and failure semantics rather than model accuracy.

**G1 — Governed training action:** `@totemsdk/act-training` over `AgentEdgeRuntime` + neutral TrainingPort; prepared-command digest bound into authorization and durable operation; compute ceilings, lease/renewal and terminal actual accounting; simple Edge dispatch cannot bypass the training grant.

**G2 — Collection integrity and rights:** example/collection codec, rights/quality report, independently held test precommit, split leakage and contamination checks, exclusions and quarantine traversal.

**G3 — Concrete QVAC TrainingPort:** typed fine-tune, progress, cancellation, native compatibility preflight, accurate job statuses, no fabricated checkpoint support; model artifact verified through existing Storage/replication bridge.

**G4 — Evaluation gate:** independently attributable evaluator, candidate/active/naive paired tests, safety and abstention checks, signed report and approval binding; raw output access restrictions.

**G5 — Model Release and deployment:** signed descriptor, verifier recipe, active pointer, shadow/canary/revocation, automatic rollback with audit evidence and rights-aware quarantine.

**G6 — Optional Experience integration:** only after RFC-047 Phase 0 has its written report and outcome; fixture adapter replaced or supplemented without changing training contracts.

**G7 — Optional remote distribution qualification:** cross-node fetch, proof/signature/key-status verification, artifact integrity, compatibility, denial on revoked evaluation, lineage and rollback. This is **not federated aggregation**.

### 12.1 Mandatory golden and adversarial test vectors

1. Same canonical example -> identical digest; single altered label/evidence/split/rights/transform byte -> digest mismatch; unsupported schema or unknown semantic field rejects.
2. Collection ordering, repeated example IDs, tampered exclusion, changed split and altered composer quality report detected.
3. Held-out seal and thresholds predate training example selection; train principal cannot read held-out bytes; temporal/site/device overlap and near-duplicate/benchmark-canary contamination fail certification.
4. Controller reports success while camera reports failure -> `labelDisagreement`; cannot silently promote as verified success.
5. Completion-only agent grant cannot initiate fine-tuning through **either** AgentEdgeRuntime or simple Edge; direct provider API is host-only.
6. Prepared Training Run descriptor or compute envelope swapped after authorization -> execution denied.
7. `accepted` does not commit; `OPERATION_PENDING` does not abort; `unknown` holds; confirmed cancellation requires terminal evidence; known-executed failure settles verified actual consumption (1,000/400/600 ledger vector, including mandate rows) rather than full reserved or zero. Post-expiry terminal settlement uses recovery, not `commit()`.
8. Duplicate ID + crash after dispatch: no second training run; missing worker record => unknown; lease expiry never releases uncertain work.
9. Multi-hour heartbeats/renewals stop at absolute approved ceiling; overrun terminates or quarantines according to declared enforcement policy; missing metering cannot become zero.
10. Lease exhaustion, mandatory signer unavailability, storage failure and revoked/expired evaluation => fail closed before start/promotion as relevant.
11. Fake candidate evaluated against active and naive using same sealed harness; evaluator identity not trainer identity for independent classification; report signature/commitment tampering fails.
12. Model Release signature, code/env/base/adapter/tokenizer/collection/evaluation digest tampering fails; incompatible hardware rejected.
13. Shadow/canary regression forces authorized rollback; prior release remains verifiable; stale or revoked active pointer denied.
14. Quarantine one poisoned example -> identify affected collections/runs/releases; historical actions retain attributed but revoked release identity.
15. RFC-022 Amendment A proves existing `act-mavlink` `flight:startMission`/`hold`/`returnToLaunch`/`land` and `act-ocpp` `charging:startSession`/`stopSession` semantics, SQLite/in-memory ledger balances, crash/restart idempotence and synchronous compatibility. Training must not bypass that release gate.
16. Dependency graph and package export gates pass; no `intelligence -> agent-policy` import, `act-training -> qvac` import, or `experience` package dependency.

### 12.2 Release-blocking assertions

- **No job dispatch without** a valid immutable descriptor, authorized scoped capability, durable operation/reservation identity, sufficient resources, allowed data rights and required evidence/signing capacity.
- **No independent certification without** precommitted held-out isolation, attributable evaluator, signed test report and precommitted acceptance thresholds.
- **No promotion without** a valid, nonrevoked evaluation and an authorized, durable rollback-capable release-pointer operation.
- **No automatic retry** of uncertain executions, and **no claim** that source lineage guarantees absence of poisoning or undisclosed training.

## 13. RFC and repository hygiene

- RFC-077 owns **new** adaptive intelligence lifecycle requirements. Do **not** reopen RFC-006 as if its previously landed phases had not shipped. Add a one-line forward pointer/status note to RFC-006 and a cross-reference in RFC-047 without altering its Phase-0 kill criterion.
- Record general async Act correctness in **RFC-022 Amendment A** as a separate formal behaviour change linked from RFC-010/011/022. It needs its own PR, published dependency-ordered release, ledger regression proof, qualification registry update and consumer migration note **before** RFC-077's governed training actions.
- Regenerate RFC index, metadata, MCP index if packages/exports change, package manifests, documentation and dependency graph checks per existing repository gates.
- Keep the source in plain Markdown, with terminal-friendly tables and code blocks; no Mermaid-generated CSS or vendor marketing as normative protocol language.

## 14. Open implementation questions (not open architectural decisions)

1. Which minimal additive typed property best commits the prepared descriptor into the existing canonical agent action and persisted reservation without breaking historical signatures/digests?
2. Where should the common asynchronous result/reconciliation adapter be refactored so `act-mavlink`, `act-ocpp` and `act-training` share its semantics without regressing industrial operation contracts?
3. Which tested durable settlement-intent and idempotent replay protocol applies if operation and run state stores use different backends? RFC-022 Amendment A already requires atomic run + mandate updates where they share SQLite, and fail-closed recovery otherwise.
4. Which QVAC SDK version's training and lifecycle APIs are actually supported by a verified native worker target, and which progress/cancellation/inspect features can be truthfully guaranteed?
5. What are the initial task-specific evaluator policy, hardware enforcement mechanisms and evidence-retention rules for the first non-synthetic demo?

**Decision rule:** implement the fake-source/fake-trainer/fake-evaluator vertical slice after the general Act correctness prerequisite, then replace individual seams with real providers and sources only once the conformance gates pass. Do not promote a proof-of-concept fine-tune into a claim of certified adaptive intelligence.
