# RFC-047 — Experience Spine (Reuse-First)

Status: Approved for Phase-0 research only — no `@totemsdk/experience` package is authorised yet
Created: 2026-10-16
Authors: Totem SDK Contributors
Depends on: RFC-007 (Storage), RFC-017 (Decision Receipt Graph), RFC-019 (Governed Commerce), RFC-021–030 (Decision/Industrial runtime)
Touches (proposed): `@totemsdk/experience`; reads `@totemsdk/storage` (Journal + ArtifactStore), `@totemsdk/proofgraph`, `@totemsdk/core`
Amended: §26–§30 (Physical-AI model activity & provenance, Fixture C, Phase-0 test delta, adversarial review, changelog)

> **Numbering.** `RFC-020` belongs to Multi-Package Adversarial Hardening. `RFC-040` and
> `RFC-041`–`046` are used by the Canary repository. This document is `RFC-047`; the number
> was confirmed free in both repositories at the reviewed baseline.

> **Scope.** This RFC replaces the earlier general-purpose Experience proposal (independent
> recorder, graph engine and provenance store) with a **reuse-first** architecture. It
> authorises **Phase 0 only**: an architecture/conformance spike that may conclude the
> package should not exist.

---

## 1. Decision

Experience remains a valid architectural concept, but its implementation must be far
narrower than previously proposed. The correct factoring delegates mechanics that already
exist and keeps only the domain semantics that do not.

| Existing subsystem | Responsibility |
|---|---|
| `@totemsdk/storage/journal` | Durable ordered records, replay, CAS sequence allocation, recovery |
| `@totemsdk/proofgraph` | Evidence relationships, derivation, receipt/proof lineage, graph queries |
| `@totemsdk/storage` ArtifactStore | Content-addressed evidence bytes |
| `@totemsdk/core` | Cryptographic hashing and canonical primitives |
| `@totemsdk/experience` | Typed activity, physical time alignment, control origin, bounded Episode composition |

**Experience SHALL NOT recreate functionality already supplied by Storage, ProofGraph or
ArtifactStore.** Reuse is a normative architectural constraint, not a recommendation.

The initial package is conditional on a Phase-0 spike proving a small domain-specific
package is warranted.

---

## 2. Why Experience Still Exists

ProofGraph and Experience both care about provenance, but answer different questions.

- **ProofGraph:** *How are proofs, claims, receipts, identities and evidence related?*
- **Experience:** *What activity unfolded over time, under which control origin, with which
  time-aligned physical observations?*

ProofGraph already provides relationships including `issued_by`, `signed_by`, `references`,
`derived_from`, `supports`, `anchored_to`, `controls` and `depends_on`. Experience does not
duplicate that vocabulary.

ProofGraph does not natively define:

- Physical recording **Sessions** and bounded **Episodes**.
- Time-aligned multimodal **sensor streams**.
- **Clock domains** and synchronisation uncertainty.
- Human demonstration vs autonomous control, and **control handovers**.
- Recording **completeness** and missing-sample intervals.
- **Episode sealing** over a bounded journal interval.
- **Model-produced action streams (PLA/VLA)**, including chunked actions, that have no Decision selection.

The package is justified only by this distinct responsibility.

---

## 3. Foundational Architecture

Totem's operational model remains **SENSE → PROVE → DECIDE → ACT → SETTLE**. Experience is
a temporal activity layer spanning or complementing that model — not a sixth control stage.

```
                 @totemsdk/experience
                          │   Typed physical activity · Clock/time alignment
                          │   Control origin · Session/Episode composition
          ┌───────────────┼────────────────┐
          ▼               ▼                ▼
    Storage Journal   ArtifactStore    ProofGraph
    ordering/CAS      evidence bytes    relationships
    recovery          content hashes    graph queries
```

ProofGraph integration is optional and MUST NOT be required to verify an Episode.

The root package SHOULD depend only on `@totemsdk/core` and `@totemsdk/storage`. A future
`@totemsdk/experience/proofgraph` subpath may implement graph projection.

---

## 4. Mandatory Reuse Rules (normative)

1. **Ordered recording** — reuse `@totemsdk/storage/journal`: `createJournal()`, CAS-allocated
   sequences, `JOURNAL_RECORD_VERSION`, versioned records, `read`/`readSince`/`tail`,
   `recover()`, ack-mode requirements and strict corruption handling. Do **not** implement an
   independent append-only journal.
2. **Evidence bytes** — reuse ArtifactStore and `ArtifactRef`. Do not create a second
   content-addressed blob store.
3. **Evidence relationships** — reuse ProofGraph. Do not implement another graph traversal or
   evidence DAG framework.
4. **Canonical hashing** — reuse Totem's canonicalization/hashing conventions (new
   domain-separated commitments for Experience objects are allowed). Do not create another
   generic codec or hashing framework.

---

## 5. The Three Distinctive Primitives

The Spine owns exactly three categories of domain semantics; anything else must be justified
as minimal composition mechanics.

1. **Typed activity** — observation, human/machine control input, inference reference,
   decision reference, authorization reference, action state transition, verification
   reference, intervention, recording gap.
2. **Physical time alignment** — clock domains, sample timestamps, synchronisation
   relationships, uncertainty, bounded stream intervals, calibration/frame references.
3. **Control origin** — human-demonstration, human-teleoperation, autonomous, scripted,
   simulation, mixed, unknown.

---

## 6. Journal Records, Not Another Storage Format

Experience activity records SHALL be stored as existing **Storage Journal** records. The
Journal owns the outer envelope (record `version`, `seq`, `createdAt`, payload, recovery and
replay). Experience adds only a domain payload contract:

```ts
interface ExperienceActivityRecord {
  payloadSchema: string;                      // e.g. 'totem:experience:observation/v1'
  activity: Readonly<Record<string, unknown>>;
}
```

- Do not duplicate the Journal's `seq`/`version`/acknowledgment fields.
- A committed physical occurrence time, clock identity or causal reference belongs **inside
  the activity payload**.
- Do not treat the Journal's `createdAt` as an authoritative physical timestamp.

> **Journal time is recording time, not necessarily event occurrence time.**

---

## 7. Stable and Scoped Identifiers

```ts
interface ExperienceRef {
  owner: string;        // package / subsystem / external authority defining the id
  namespace: string;    // the kind or identifier domain within that owner
  id: string;           // the canonical identifier within (owner, namespace)
  digest?: string;      // optional content commitment
}

interface ExperienceScopedId {
  owner: string;
  id: string;
  scope: { ref?: ExperienceRef; digest?: string; parentId?: string };
}
```

- An identifier MUST NOT be promoted to a canonical reference merely because its field is
  named `id`.
- A Decision `DecisionTarget.id` is **scoped** to its selected operation and candidate set;
  the future Decision adapter must preserve that scope and native binding digests.
- For industrial workflows, a semantic Decision target may differ from the resolved physical
  resource; Experience preserves the distinction and does not invent a competing receipt
  hierarchy.
- Phase 0 may collapse redundant fields if the identity is still unambiguous.

---

## 8. Experience Session

```ts
interface ExperienceSession {
  sessionId: string;
  journalId: string;                 // stable journal identity — see §9.1
  subjectRef: ExperienceRef;
  mode: 'real' | 'simulated' | 'hybrid';
  initialControlOrigin: ExperienceControlOrigin;
  startedAt: number;
}
```

- A Session maps to an **unambiguous Journal identity**. Preferred initial approach: **one
  logically isolated Journal namespace per recording Session**, so Sessions never interleave
  in a shared sequence space.
- A shared multi-session Journal is allowed only with an explicit, equally verifiable
  membership/index commitment. Do not silently assume a global Journal interval contains
  one Session's records.

---

## 9. Journal Identity and the Episode Commitment

### 9.1 Journal identity

The current Journal exposes `JournalOptions.namespace` (a key prefix, default
`totem_journal:v1:`), **not** a first-class `journalId`. RFC-047 MUST NOT assume one exists.
Phase 0 evaluates:

- **Option A — namespace-derived identity.** A permanently assigned namespace as the stable
  identity, with a documented assignment policy preventing collision across Sessions/storage
  domains. The default namespace must not be reused for unrelated Sessions.
- **Option B — explicit persisted identity.** Generate and persist a stable identity bound to
  the namespace + storage domain (minimal Experience wrapper, or a small additive Storage API
  if justified).

**Invariant:** two distinct Journals must not produce ambiguous Episode references merely
because local sequence numbers overlap. The chosen identity is bound into every interval
commitment.

### 9.2 Episode as a bounded journal commitment

```ts
interface ExperienceJournalRef {
  journalId: string;
  namespace: string;
  fromSeq: number;
  toSeq: number;
  algorithm: 'sha3-256';
  intervalDigest: string;

  // NOTE: no single journalRecordVersion. The digest binds each entry's own
  // JournalEntry.version (per-entry, forward-migratable). See §10.
}

interface ExperienceEpisodeBody {
  schema: 'totem:experience:episode/v1';
  sessionId: string;
  journalRef: ExperienceJournalRef;
  subjectRef: ExperienceRef;
  mode: 'real' | 'simulated' | 'hybrid';
  startedAt: number;
  endedAt: number;
  completeness: { status: 'complete' | 'partial' | 'unknown'; gapCount?: number };
  outcome?: ExperienceOutcome;
}

interface ExperienceEpisode extends ExperienceEpisodeBody { episodeId: string }
```

The Episode ID is derived from its canonical body (including `journalRef.intervalDigest`).

> **Invariant.** An Episode commits to one precisely identified, bounded sequence of journal
> records and cannot change merely because the underlying Journal later grows.

The Episode SHOULD be persisted as a **content-addressed ArtifactStore artifact**; the durable
Session seal state then only carries `{ episodeId, fromSeq, toSeq }`.

---

## 10. Interval Commitment — Commit the As-Stored Record

The interval digest MUST represent **what Storage actually committed**, never an application
object created before persistence, and **never the migrated view**.

> **Migration hazard.** `JournalEntry.version` is per-entry and `JournalOptions.migrate` is
> invoked on *every read* of an entry whose version predates `JOURNAL_RECORD_VERSION`.
> The public `read(fromSeq, toSeq)` therefore returns migrated entries. If the digest were
> computed over `read()` output, adding or changing a `migrate` function would retroactively
> change the digest of old intervals and break every previously sealed Episode.
>
> **Therefore: the digest is computed over the as-stored (pre-migration) committed record.**

Phase 0 must resolve how as-stored access is obtained:

- **Option A — canonical reconstruction.** Reconstruct the as-stored representation with the
  Journal's storage encoding + core canonicalization, and demonstrate equivalence across
  append, serialization, restart, replay, recovery, supported adapters, and record-version
  migration. Reconstruction must include the full committed envelope: original per-entry
  `version`, `seq`, `createdAt` and payload.
- **Option B — minimal Storage support.** If faithful as-stored access is impossible through
  public APIs, propose a narrowly scoped additive **Storage** capability that exposes a stable
  canonical committed-record encoding. This belongs to Storage and must not create a competing
  Experience codec.

**Decision rule:** reuse existing Storage encoding if correctness can be demonstrated; extend
Storage only when a specific failed conformance test proves the extra capability necessary.

The commitment binds, in order: journal identity; the interval `fromSeq`/`toSeq`; and the
as-stored representation (including each entry's own `version` and `seq`) of every entry.

Conceptual rolling digest (pseudocode; use unambiguous, length-delimited canonical encoding
and core primitives — never unsafe string concatenation):

```
D0 = HASH(domain="totem:experience:interval/v1", journalIdentity, fromSeq, toSeq)
Di = HASH(Di-1, canonicalAsStoredEntry[fromSeq + i - 1])      for each i in interval
intervalDigest = Dn
```

An empty interval (if supported) MUST have an explicitly defined canonical commitment. An
Episode ID is derived from its canonical body including `intervalDigest`. The verifier
reproduces both digests from the persisted records **without** ProofGraph.

---

## 11. Sealing: Exclusive Coordination + CAS Seal Marker

A CAS seal marker alone is **not** atomic with Journal appends — they are separate operations.
Experience MUST also enforce **exclusive append/seal coordination**.

Initial Spine: **a single logical writer per Session**, with all append/seal operations passing
through a shared coordinator that serialises them. The Session maintains a durable CAS state:

```ts
type ExperienceSealState =
  | { state: 'open' }
  | { state: 'sealing'; generation: number }
  | { state: 'sealed'; generation: number; fromSeq: number; toSeq: number; episodeId: string };
```

Sealing procedure:

1. Stop admitting further appends.
2. Drain already-admitted appends to a durable state (or a documented recoverable state).
3. CAS Session state `open → sealing`.
4. `toSeq = getHead()` — the **last contiguous durably-recorded** sequence (after `recover()`
   if the head is suspect). Never use "last admitted".
5. Fix `toSeq`; read and verify the bounded interval.
6. Compute `intervalDigest`.
7. Persist the immutable Episode (as an ArtifactStore artifact — §9.2).
8. CAS Session state `sealing → sealed`.
9. Reject subsequent appends through the Session API.

The append-admission check and the sealing transition MUST NOT have an unprotected race. A
serialised operation queue + durable Session state is acceptable **if the deployment genuinely
guarantees one writer**. A separate process able to write the same Journal must not bypass that
assumption unnoticed. Multiple independent writers require fencing/ownership or an equivalent
provably-safe admission mechanism — **a CAS marker and an unfenced append permit are not
sufficient for multi-process safety.** Phase 0 must demonstrate the single-writer invariant or
identify the minimal additional mechanism.

Direct writes to the Journal outside the Experience Session API may extend the Journal but
MUST NEVER alter an already-committed Episode interval.

---

## 12. Interrupted Sealing and Recovery

Phase 0 must demonstrate recovery can distinguish:

- A complete durable interval awaiting final Episode persistence.
- An Episode persisted before the final seal marker.
- An append admitted but not durably recorded.
- A Journal head requiring `recover()`.
- A corrupt or missing record within the committed interval.

Recovery MUST NOT invent completion or silently move the sealed boundary. If a uniquely
correct interval cannot be established, recovery must surface explicit uncertainty and decline
to finalise automatically. Re-sealing a successfully sealed Session returns the same Episode
or rejects deterministically — never a second inconsistent Episode.

---

## 13. Episode Verification (ProofGraph-free)

The verifier requires only the canonical Episode, the referenced Journal records, and core
hashing/canonicalization:

1. Validate Episode schema.
2. Validate Journal identity and sequence bounds.
3. Read the exact committed interval **as stored** (§10).
4. Validate record envelopes + sequence continuity.
5. Recompute `intervalDigest`.
6. Recompute `episodeId`.
7. Report **structural integrity** and **completeness** separately.

Structural verification is not semantic verification. A verified Episode referencing a
Decision receipt does not establish the Decision was correct; that remains the owning
package's responsibility.

---

## 14. Versioning and Codec Reuse

- `JOURNAL_RECORD_VERSION` remains the outer persistence-format authority.
- Experience introduces a **payload schema identifier** per activity type only.
- Experience MUST NOT reinterpret an unknown future payload schema as a known one.
- Hashing consumes the **as-stored** committed representation (§10).
- No second generic codec framework.

---

## 15. Durability Guarantees and Honest Recovery

- The Journal's `requireAckMode` (default `durably-acknowledged`) defines the persistence
  guarantee. A volatile/buffered backend MUST NOT present itself as crash-safe forensic storage.
- The initial implementation supports explicit recording profiles naming the required
  acknowledgment level.
- Corrupt records must be surfaced; recovery must not silently erase committed history.
- `recover()` returns `{ headAfter, headBefore, repairedUnrecordedTail, gapAt }`, where
  `gapAt` denotes **structural corruption** the Journal refuses (a missing durable entry below
  the contiguous tail). This is distinct from Experience **`gap`** events, which describe
  **physical sample loss** (§16). Do not conflate them.

> **Normative integrity limitations.**
> **A verified chain or Journal does not prove the recording was exhaustive.**
> **A valid interval digest proves the integrity of the recorded interval, not that the
> interval represents the whole underlying activity.**

A camera may drop frames before they ever reach the Journal: the Journal can be perfectly
intact while the physical recording is incomplete. Structural integrity is never proof of
exhaustive or truthful physical capture.

---

## 16. Recording Gaps and Completeness

Experience MUST represent missing/degraded observations explicitly: dropped frames, buffer
overflow, missing telemetry, sensor disconnection, clock discontinuity, interrupted recording,
artifact persistence failure, deliberate capture exclusion. A gap activity payload may report
a reason code, source/channel, available time bounds, estimated/known sample loss and the
reporting component.

Two distinct claims, never conflated:

- **Complete Journal interval** — every Journal record within the committed range is present
  and valid (structurally verifiable).
- **Complete physical recording** — the recorder claims it captured everything its recording
  policy required (a separate claim needing additional evidence/trust).

---

## 17. Physical Time and Clock Domains

```ts
interface ExperienceTimePoint {
  clockId: string;
  ticks: string;                       // decimal text — avoids JS precision loss
  tickUnit: 'ns' | 'us' | 'ms';
  wallTimeMs?: number;
  uncertaintyNs?: string;
}
```

Required semantics: a device monotonic clock is not UTC; two devices may be incomparable;
synchronisation relationships must be explicit; uncertainty preserved; missing timestamps
remain missing; Journal recording order does not determine physical occurrence time.

**The contract is provisional** — Phase 0 selects the minimum schema that represents both
fixtures faithfully and may remove or defer fields.

---

## 18. Bounded Sensor Stream References

```ts
interface ExperienceStreamRef {
  artifactRef: ArtifactRef;            // { namespace, algorithm: 'sha3-256', digest }
  format: string;
  schemaRef?: ExperienceRef;
  clockId: string;
  start: ExperienceTimePoint;
  end: ExperienceTimePoint;
  sampleCount?: number;
  nominalRateHz?: number;
  calibrationRef?: ExperienceRef;
  frameId?: string;
  synchronization?: { method: string; referenceClockId?: string; uncertaintyNs?: string };
}
```

Covers RGB/depth/LiDAR/IMU/joint-state/CAN/audio/ROS-MCAP segments without expanding every
sample into a graph node or Journal record. Bytes stay in ArtifactStore; the descriptor
records timing, interpretation and provenance. Not a new media container or dataset format.

**Provisional** — `sampleCount`, `nominalRateHz`, `frameId`, synchronisation method MUST NOT
become mandatory v1 fields automatically; prefer the smallest representation that preserves
meaning. A stream reference is immutable once its underlying ArtifactRef is final.

---

## 19. Control Origin and Handover

```ts
type ExperienceControlOrigin =
  | 'human-demonstration' | 'human-teleoperation' | 'autonomous'
  | 'scripted' | 'simulation' | 'mixed' | 'unknown';
```

The Session declares an initial origin; changes are represented by activity records (e.g.
autonomous → human takeover → teleoperation → autonomous). A human demonstration requires no
invented Decision/Authority receipt; an autonomous action preserves available native Decision
and Authority references.

> **Orthogonality invariant.** Execution environment (`mode`: real/simulated/hybrid, §8) and
> control origin are **independent dimensions**. Every combination is representable, each may
> change during an Episode, and neither is ever inferred from the other. A simulation MUST NOT
> masquerade as real, and a human demonstration MUST NOT imply autonomy (or vice versa).
> Control handovers are recorded as transitions and preserved. See §26.3.

---

## 20. Transformation, Quality and ProofGraph

- Minimal derivation references (input/output artifact refs, process/model ref, parameter
  digest, reported quality) are allowed; no universal transformation engine or QA pipeline.
- Capture quality, annotation/derivation quality and outcome quality remain distinct; no
  universal numeric score.
- **ProofGraph integration is deferred.** The root package stays ProofGraph-free; a later
  `@totemsdk/experience/proofgraph` subpath may project *significant* proofs/receipts/
  artifacts/lineage — never a node per frame/sample. Projection MUST NOT become required for
  Episode verification.

---

## 21. Deferred Capabilities

- **Autonomous black boxes** (§ later phase): rolling buffers, triggers, retention classes,
  recorder independence, integrity checkpoints, hardware attestation, forensic reconstruction.
  A black-box record references an Episode rather than a new canonical history object; a
  truncated window must make its boundary explicit and never masquerade as complete history.
- **Collections / evaluation**: frozen Episode selections for training/evaluation/analysis;
  declared lineage preserved; Totem does not claim recorded membership proves absence of
  undisclosed training data.
- **Interop**: MCAP / ROS bag / LeRobot import-export must preserve time semantics, control
  origin and source-artifact integrity; no invented commands or timestamps.

---

## 22. Phase 0 — Architecture Spike (throwaway research)

**No production `@totemsdk/experience` package is authorised by this RFC.** Phase 0 is an
architecture/conformance experiment that composes existing primitives:

1. Storage Journal. 2. ArtifactStore. 3. ProofGraph. 4. Core hashing/canonicalization.
5. Two representative workflows.

The builder may use temporary scripts/fixtures/scratch code; these do not establish production
APIs. The deliverable is a **written Phase-0 report**, not a published package.

### 22.1 Fixture A — Human physical demonstration

Human-demonstration origin; real or appropriately simulated sensor data; RGB (and optional
depth/IMU/pose); clock-domain metadata; calibration reference; bounded stream artifacts;
optional completeness/quality. MUST NOT invent AI inference, Decision receipts, robot action
commands, mandates or authorization events. Output: a bounded Episode over a durable Journal
interval.

### 22.2 Fixture B — Governed autonomous operation

Observation → (Intelligence) → validated Decision result → scoped operation/target →
trusted semantic-to-physical mapping → prepared operation → Authority/Agent Policy references
→ execution → async state transition → reconciliation → post-action observation →
(verification). MUST reuse native identities/receipts; MUST NOT create replacement Decision/
Authority/Industrial receipts. Output: a bounded Episode over a durable Journal interval.

### 22.3 Required sealing test

Append records → deterministically seal an interval → compute `intervalDigest` and `episodeId`
→ append further records → confirm the original Episode still resolves to exactly its original
interval → recompute the commitment → mutate/remove an interval record adversarially → confirm
detection → simulate an append/seal race → confirm a deterministic, documented outcome. The
test includes journal identity and MUST NOT rely on ProofGraph.

### 22.4 Required tests

1. Two Journals with overlapping sequences cannot be confused.
2. Interval commitment binds journal identity.
3. Interval commitment binds applicable format/version semantics (per-entry).
4. Digest matches the **as-stored** committed representation (incl. a migration added after
   sealing: old Episode digest must not change).
5. Reopen/replay reproduces the digest.
6. Later appends do not alter an existing Episode's digest/ID.
7. Mutation/omission/reordering detected.
8. Stale append rejected after sealing.
9. Append/seal race deterministic and documented.
10. Crash during sealing recovered or reported unresolved.
11. Verified interval with reported missing samples stays explicitly incomplete.
12. Human demonstrations require no fabricated Decision/Authority objects.
13. Governed autonomous actions preserve native identifiers and trust boundaries.
14. Episode verification succeeds without loading ProofGraph.
15. Minimum clock/stream contract handles representative data without a full robotics framework.

Any unproven safety invariant is a **blocker**, not an optimistic assumption.

### 22.5 Acceptance questions

1. Can Storage Journal express both workflows without a new persistence engine?
2. Can ArtifactStore carry all large data without a new blob abstraction?
3. Can ProofGraph represent required evidence relationships without substantial vocabulary growth?
4. Can bounded journal sealing produce stable Episode IDs?
5. Can a sealed interval be independently verified?
6. Can concurrent append/seal be made unambiguous?
7. Can physical time remain distinct from recording time?
8. Can human and autonomous control origins be represented faithfully?
9. Can missing samples be reported without corrupting an otherwise valid Journal?
10. Can the root contract remain independent of ProofGraph and all execution packages?
11. Does the abstraction add functionality genuinely absent from current packages?
12. Is a separate package more coherent than a few small additions to existing owners?

### 22.6 Decision rule

- **Outcome A — thin Experience package.** Existing primitives suffice; only a small number of
  activity types are needed; the interval commitment works; time/control-origin/Episode form a
  coherent independent domain; no substantial duplication. *(Preferred expectation, not a
  foregone conclusion.)*
- **Outcome B — extend existing packages.** The additions are minor and belong naturally to
  Storage/ProofGraph/another owner; a separate package adds little. **Defer or cancel
  `@totemsdk/experience`.**
- **Outcome C — architectural redesign.** Extensive new ProofGraph node/edge types needed, or
  safe sealing is not achievable with existing Storage contracts, or critical semantics demand
  substantial native-package changes. **Stop and produce a revised proposal.**

**Phase 0 must be allowed to conclude that the package should not exist.** Outcome B or C is a
valuable result.

---

## 23. Later Phases (not authorised here)

- **Phase 1 — Minimal Spine** (only if Outcome A): activity typing/validation, canonical/scoped
  refs, Session identity, control origin, physical time/clock, bounded streams, gap/completeness,
  journal-backed composition, sealing + interval commitment, independent verification, minimal
  conformance tests, docs — using Journal/ArtifactStore directly or via a thin wrapper. No new
  generic recorder/graph/artifact store/plugin framework.
- **Phase 2 — Workflow observability**: optional adapters (Decision, Intelligence, Authority,
  Agent Policy, Industrial Action, Edge, async physical lifecycle), preserving native semantics;
  prefer improving a native package's observability over making Experience infer missing facts.
- **Phase 3 — Physical-AI interop**: ROS 2 / MCAP / LeRobot, calibration/frames, richer
  synchronisation, dataset selection — only against demonstrated applications.
- **Phase 4 — Autonomous black boxes**: rolling retention, triggers, recorder integrity/
  isolation, crash recovery, forensic reconstruction.
- **Phase 5 — Datasets, evaluation, economics**: Collections, lineage, benchmarking, rights/
  consent, selective disclosure, fleet learning, contribution verification, Omnia-linked
  economics (separate design decisions).

---

## 24. Success Criterion

The Spine succeeds if **the same compact domain vocabulary faithfully describes human physical
activity and governed autonomous execution while delegating ordering to Storage Journal,
relationships to ProofGraph and evidence bytes to ArtifactStore** — with an Episode as a stable,
independently verifiable commitment to a bounded Journal interval that preserves control origin,
physical timing and uncertainty without inventing facts. If this cannot be achieved without
substantial duplication, reconsider before adding code.

---

## 25. Authorisation

**Phase 0 is approved.** Authorised: repository examination; temporary experimental
implementations; two conformance fixtures; interval-commitment and sealing tests; minimal
schema exploration; a written architecture report.

**Not yet authorised:** creating the production `@totemsdk/experience` package; permanent SDK
API additions; black-box/dataset/ProofGraph extensions; general-purpose new storage mechanics;
publication; later phases.

> When Outcome A is later approved and the package is created, it must satisfy the repo's
> enforced gates: `validate-pkg-meta`, `SDK_MANIFEST` sync, MCP index parity, custody
> classification (`non-custodial` — it holds no on-chain value), `custody-golden`, and the
> release guards.

**Final principle: Reuse Storage for ordering, ArtifactStore for bytes, ProofGraph for
relationships, and introduce Experience only for the domain semantics those packages do not
already provide.**

**Define early. Prove the boundary. Build only what is missing.**

---

## 26. Amendment — Physical-AI Model Activity and Provenance

This amendment adds physical-AI model activity to the Spine's domain semantics. It introduces
**no new persistence, graph or artifact machinery**; the §4 reuse rules and the §1–§25
constraints are unchanged. It is authored against the reviewed baseline and remains within the
Phase-0-only authorisation of §25.

### 26.1 Model-produced action paths (PLA/VLA) — no Decision required

Experience MUST represent continuous or chunked **model-produced actions** even when there is
no `@totemsdk/decision` selection.

- New activity kinds: `model_action` (a model-produced action, or the boundary of an action
  chunk) and `action_chunk` (a bounded sequence of actions produced by a policy/model).
- **Invariant:** Experience MUST NOT fabricate Decision, Authority, Agent Policy or Industrial
  Action receipts. Where those native semantics genuinely exist, they are **referenced,
  unchanged**; where the model acts directly, their absence is recorded honestly.
- A direct model action records: model/policy reference, bounded input-window reference(s)
  (§26.2), the produced action as an ArtifactStore artifact (or a bounded chunk artifact),
  control origin (§19), environment (`mode`), and clock-qualified timing (§17).
- **Action-chunk semantics:** a chunk is a *bounded artifact* referenced by one activity, not
  N per-step journal records. It carries a chunk id, clock-qualified first/last timestamps and
  its sequence within the stream. The chunk boundary is meaningful and preserved.
- Native VLA/inference primitives already exist (`@totemsdk/intelligence` VLA preprocessing
  helpers; `@totemsdk/qvac` vendor VLA client results). Experience references those results; it
  does not implement model execution.

### 26.2 Inference-input provenance (no fusion engine)

Reuse `ExperienceStreamRef` (§18) and ArtifactStore to associate **bounded multimodal input
windows** with inference/action activity.

- An input window is one or more `ExperienceStreamRef`s (each with its clock domain and
  calibration ref), optionally accompanied by the native inference receipt reference.
- **Invariants:** do **not** build a sensor-fusion engine; do **not** imply an input was
  consumed without evidence. If only an unaligned or uncertain window is available, represent
  it as such (clock uncertainty preserved, §17); if there is no evidence, record the input as
  absent/unknown (`inputRefs: []` or `unknown`) rather than constructing a plausible window.
- Native provider receipts (e.g. `@totemsdk/intelligence` / `@totemsdk/qvac` results) are
  referenced, never reimplemented.

### 26.3 Execution environment is orthogonal to control origin

See the §19 orthogonality invariant. Environment (`mode`: real/simulated/hybrid) and control
origin (human-demonstration / human-teleoperation / autonomous / scripted / simulation / mixed
/ unknown) are independent and both may change within an Episode. This adds an **invariant**,
not new storage: the RFC already carries both fields.

### 26.4 Model-memory provenance (optional, opaque-friendly)

Experience MAY reference **model-owned input/output state artifacts** where they are actually
available (e.g. context/KV or latent-state blobs) as `ArtifactRef`s.

- `opaque`, provider-managed, or `unknown` state is explicitly representable; absence is a
  first-class value.
- **Invariants:** do not implement a memory engine; do not claim to reconstruct internal model
  reasoning. A memory reference is evidence about *state bytes*, not about *reasoning*.

### 26.5 Embodiment-configuration provenance

Experience MAY record **optional immutable references** to the hardware, software, sensors,
effectors and calibration configuration relevant to an Episode.

- Reuse existing `@totemsdk/manifest` (Manifest), `@totemsdk/identity` / `@totemsdk/root-identity`,
  and ArtifactStore abstractions wherever appropriate.
- **Invariants:** do NOT create a competing embodiment-manifest framework; a description of
  physical action limits is NOT an Authority grant (§32 of the prior framing).

### 26.6 Deferred learning lineage (documentation only)

No implementation in the root package. The following describe how future capabilities *could*
link through existing refs and ProofGraph:

- **Episode ↔ model/skill release** — a ProofGraph edge between the Episode node and the
  release's `identity`/`evidence`/`receipt` node (existing node/edge types).
- **Episode ↔ deployment** — an identity/attestation node reference.
- **Collection / evaluation** — a frozen set of Episode IDs (Phase 5, §21).
- **Skill registry / "Time-to-Skill"** — NEURA terminology, **not an SDK concept**. Representable
  only as *declared references* or a *derived metric*, never as authoritative committed types.
- **Invariants:** "no undisclosed training" cannot be proven (inherited from the prior RFC §39);
  Time-to-Skill is a derived metric, not a committed fact. No training, evaluation, skill-registry
  or fleet-learning engine is built in the root package.

---

## 27. Phase-0 Fixture C — Multimodal Physical-AI Inference/Action (no mandatory Decision)

A third conformance fixture, independent of Fixture B's Decision runtime.

**Input:** bounded multimodal observation windows (≥2 modalities, e.g. RGB + a state/IMU
channel) with distinct clock domains and a calibration ref; a model/VLA inference producing a
continuous or chunked action with **no Decision selection**; optional opaque model-memory
state; optional embodiment-configuration refs; an environment (`mode`) and a control origin.

**Expected output:** a bounded Episode over a durable Journal interval containing
`model_action` / `action_chunk` activity with bounded input-window `StreamRef`s, referenced
native inference results, and honest completeness/outcome — with **no** fabricated Decision,
Authority or Industrial Action receipts.

**MUST NOT:** build a fusion engine; invent consumed inputs; expand an action chunk into
per-step events; claim model reasoning from a memory blob; invent authorization.

---

## 28. Phase-0 Test Delta (Fixture C)

Added to the §22.4 suite:

- **C1** — a continuous model-produced action is recorded with **no** Decision/Authority
  receipts, and verification confirms the *absence* rather than fabricating them.
- **C2** — a chunked action is represented as bounded chunk artifacts with preserved boundaries;
  it is not expanded into per-step journal records.
- **C3** — incomplete inputs: a window with a missing modality or absent evidence is recorded as
  incomplete/`unknown`; no input is implied to have been consumed without evidence.
- **C4** — unaligned clocks across modalities stay in distinct clock domains with uncertainty
  preserved; no silent synchronisation.
- **C5** — opaque / provider-managed / unknown model-memory state is representable without a
  memory engine; absence is allowed and explicit.
- **C6** — an uncertain outcome (model claims success, no independent verification) remains
  `unknown`/`partial`, distinct from verified.
- **C7** — environment/origin orthogonality: simulated+autonomous and real+teleoperation are
  recorded distinctly; a control handover within the Episode is preserved.
- **C8** — Fixture C verifies **without** ProofGraph, and the root package loads no Decision,
  Intelligence, Edge or QVAC dependency.

---

## 29. Adversarial Review of This Amendment

Each requested change classified against the SDK and the RFC.

| Change | Verdict | Rationale / grounding |
|---|---|---|
| PLA/VLA action path | **New activity kinds** | No such activity type exists; VLA *execution* is already owned by `intelligence`/`qvac` → reference, don't build. |
| Inference-input provenance | **New invariant + reuse** | Reuses `StreamRef`+ArtifactStore; adds "no fusion engine / no implied consumption"; native receipts referenced. |
| Environment ⊥ control origin | **Already two fields** | §8 already carries `mode` and `controlOrigin`; amendment adds orthogonality + handover invariants only — **no new storage**. |
| Model-memory provenance | **New optional refs** | Opaque/unknown allowed; no engine; not a reasoning claim. |
| Embodiment-configuration provenance | **New optional refs** | Reuses `manifest`/`identity`/artifacts; no competing manifest. |
| Deferred learning lineage | **Documentation only** | Collections already deferred (§21); skill registry / Time-to-Skill = NEURA terms → no committed types; belongs to later phases + ProofGraph. |
| One-package direction | **Unchanged constraint** | Adapters remain `@totemsdk/experience/*` subpaths; repo already uses an `exports` map and MCP indexes subpaths — feasibility confirmed by Phase 0, not assumed. |
| Constraints (Journal/ArtifactStore/Core/ProofGraph) | **Unchanged** | No new persistence, graph or codec. |

**Explicitly rejected:** adding abstractions solely because NEURA marketing uses the term —
i.e. a "skill registry", "Time-to-Skill" as a committed type, or a "memory engine". These are
at most declared references or derived metrics.

---

## 30. Changelog

- **Added §26** — Physical-AI model activity & provenance: PLA/VLA action paths (26.1),
  inference-input provenance (26.2), environment⊥control-origin invariant (26.3), model-memory
  provenance (26.4), embodiment-configuration provenance (26.5), deferred learning lineage (26.6).
- **Added §27** — Phase-0 Fixture C (multimodal Physical-AI inference/action without a Decision runtime).
- **Added §28** — Phase-0 test delta (C1–C8).
- **Added §29** — adversarial review classifying each change (new / already-covered / deferred / elsewhere).
- **Amended** — header (amendment pointer) and §2 (added model-produced action streams); §19
  (added the environment⊥control-origin invariant).
- **Unchanged** — §1–§25 reuse rules, package-boundary constraints and the Phase-0-only
  authorisation. No production implementation is authorised by this amendment.
