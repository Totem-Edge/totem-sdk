# RFC-007 Amendment A — Edge Persistence Injection Point & Evidence-Byte Ownership

**Status:** Proposed (review) · **Date:** 2026-09-28 · **Amends:** RFC-007
**Touches:** `@totemsdk/storage`, `@totemsdk/edge`, `@totemsdk/edge-adapters`, `@totemsdk/proofgraph`
**Depends on:** RFC-007 §1.1, §3.5, §3.6, §4.1–§4.3, §5, §6
**Depends on (design):** RFC-006 (intelligence/QVAC boundaries), RFC-017 / ProofGraph evidence lifecycle

> This is a focused amendment, not a rewrite. It adds one runtime injection point,
> makes one existing adapter property observable, closes the "original bytes have no
> owner" gap for evidence, and records the `ArtifactStore` consumer families so the
> deferred chunking/GC work in RFC-007 §4.3/OQ7 has a named first consumer.

---

## A.1 Summary

RFC-007 defines the storage contracts but leaves three things under-specified:

1. **No standard persistence injection point** for edge adapters, so adapters invent
   local stores. Several already inject `StorageAdapter`/`CasStore` ad hoc
   (`industrial-action/src/{approvals,events,locks}.ts`, `edge-mqtt/src/durable-queue.ts`).
2. **No observable corruption policy.** `failurePolicy` is a private option on
   `FileStore`/`SqliteStore`/`IdbStore` (`file-store.ts:154`, `sqlite-store.ts:112`,
   `idb-store.ts:66`); a consumer cannot verify the policy of an injected adapter
   before a corrupt read has already been converted to `null`.
3. **No mandatory end-to-end ownership path for original bytes.** ProofGraph already
   provides an `ArtifactStore`-backed evidence owner, but proof/capture flows are not
   *required* to route the original bytes into it, nor to bind the claim → committed
   `contentHash` → `ArtifactRef` relationship. The proof packages commit to
   `contentHash`/`merkleRoot` and expose only an optional `uri?`
   (`raster-proof/src/types.ts`), so a commitment whose original bytes are never
   retained or resolvable remains constructible. The gap is the missing mandatory
   path and binding, not the absence of an owner. "Storage-free" was a statement about
   the primitive, not about the *system*.

This amendment fixes (1) and (2) with a two-surface edge port and an observable
failure policy, and fixes (3) by (a) clarifying that the proof packages stay
storage-free **as primitives**, and (b) making the original-byte path **mandatory and
verified** — captured bytes route into the `ArtifactStore`-backed evidence owner, and
the claim → `contentHash` → `ArtifactRef` binding is enforced (not merely recorded),
with ProofGraph as the reference consumer.

The port is **optional at runtime and required when a configured feature declares
that it persists**. `assertPersistence()` and its helpers live in
`@totemsdk/storage` (no Edge semantics); `@totemsdk/edge` exposes only the two
optional slots. Scoped views are **collision-control only**; authorization stays
above the store.

---

## A.2 What this does and does not change

**Changes:**

- `@totemsdk/storage`: new neutral helpers (`PersistencePorts`,
  `PersistenceRequirement`, `EffectivePersistence`, `assertPersistence`,
  `createScopedStorage`), and `failurePolicy` becomes observable on
  `StorageAdapterWithCapabilities` (outside `StoreCapabilities`).
- `@totemsdk/edge`: two optional slots on `EdgeRuntimePorts` (`storage`, `artifacts`).
- `@totemsdk/edge-adapters`: first consumer of the injection point (Edge artifact cache).
- `@totemsdk/proofgraph`: designated reference `ArtifactStore` consumer; evidence
  byte binding made explicit.

**Does not change:**

- The proof primitives (`raster-proof`, `spatial-proof`, `location-proof`,
  `proof-integritas`) do **not** gain a storage dependency. See §A.5.
- Domain accounting authorities and their journals (agent-policy, commerce,
  watermark/lease, signing reservations) remain the owners of their state. See §A.3.4.
- QVAC provider-owned storage (RAG docs/chunks, embeddings, workspaces, model
  caches) is reached only through provider ops and is never reimplemented. See §A.7.

### Dispositions

- **`@totemsdk/edge`** — unchanged: remains **Delegate**, owns no bytes, exposes the
  two slots. The existing `edge → storage` dependency is unchanged.
- **`@totemsdk/edge-adapters`** — hosts the first consumer, typed **structurally**
  against `@totemsdk/storage` (`PersistencePorts`) so it does **not** acquire a
  runtime dependency on `@totemsdk/edge`.
- **`@totemsdk/proofgraph`** — already the **first `ArtifactStore` consumer**
  (`packages/proofgraph/src/evidence.ts:74`). The Edge artifact cache is the **first
  consumer of the new Edge persistence injection point** — *not* the first
  `ArtifactStore` consumer.

### One dependency direction

Consumers depend on `@totemsdk/storage/artifacts` (or the neutral `PersistencePorts`
bundle) and **never on `@totemsdk/edge`**. The Edge cache is the injection-point
consumer; every other consumer takes `ArtifactStore` (or the ports bundle)
structurally, exactly as required for `edge-adapters`.

---

## A.3 Normative additions — the runtime persistence port

### A.3.1 Two surfaces, not one

`EdgeRuntimePorts` gains exactly two optional fields:

```ts
storage?: StorageAdapterWithCapabilities;   // KV: metadata, references, small records
artifacts?: ArtifactStore;                  // bytes: content-addressed artifacts
```

The split is deliberate: `ArtifactStoreBackend` is a byte-mover with a different
capability vocabulary (`writable`, `retention`, `offlineReadable`) and RFC-007 §4.3
keeps it from shadowing `StorageAdapter`. External backends (IPFS/Filecoin/S3/…)
plug in **behind** `ArtifactStore`, preserving digest verification.

### A.3.2 No silent downgrade; failure policy is observable

A consumer declares a `PersistenceRequirement` and is validated at construction by
`assertPersistence()`. Absent port, insufficient acknowledgement, a lenient adapter
where strict was required, or a missing/read-only artifact store **throws**; it never
silently degrades.

`durable: true` is **not weakenable**. It means the required KV floor is **always**
`durably-acknowledged`, and the required artifact floor is always
`durably-acknowledged` when artifacts are required. `acknowledge`/`artifactAcknowledge`
may only strengthen a non-durable requirement (`durable:false`) or describe its
desired floor; an explicit crash-loss mode alongside `durable:true` is a
self-contradiction and **throws**:

```ts
if (requirement.durable &&
    requirement.acknowledge &&
    requirement.acknowledge !== 'durably-acknowledged') {
  throw new StorageError('contradictory persistence requirement', 'unavailable');
}
// same rule for artifactAcknowledge
```

Without this, `EffectivePersistence.durable === true` could coexist with a caller
explicitly requesting `volatile`/`buffered` (RFC-007: `buffered` has a bounded
crash-loss window and cannot satisfy a durable declaration).

`FailurePolicy` is orthogonal to durability and must be observable on the adapter:

```ts
interface StorageAdapterWithCapabilities extends StorageAdapter {
  readonly capabilities: StoreCapabilities;   // acknowledge | atomic | conditional
  readonly failurePolicy: FailurePolicy;      // strict | lenient — NEW, outside StoreCapabilities
  close?(): Promise<void>;
}
```

This is required so a strict consumer can reject a lenient adapter **before** a
corrupt read is collapsed into `null` and the `corrupt`/`not-found` distinction is
lost. `MemoryStore` reports `'strict'` (it cannot corrupt); all test doubles and the
conformance harness must be updated. This is a breaking interface change, consistent
with RFC-007 §6 ("all stages land without back-compat").

Artifact durability is capability-checked too: when artifacts are required,
`artifacts.capabilities.writable === true` and `artifacts.capabilities.acknowledge`
must meet the required floor (default: the same floor as the KV surface; a distinct
`artifactAcknowledge` is available). That is, a `durable:true` consumer with
`storage = durably-acknowledged` but `artifacts = volatile` is **not** durable and
must fail construction. See §A.10.

`assertPersistence()` is the **single construction-time persistence assertion**, so it
also covers the existing `StoreCapabilities` beyond acknowledgement:
`requirement.atomic` and `requirement.conditional` are checked, and the KV checks are
delegated to the existing `assertCapabilities()` rather than duplicated. This matters
because `ScopedStorage` deliberately exposes a scoped CAS facade: a consumer that
requires CAS should **declare** `conditional:true`, not probe `scoped.cas` ad hoc.

**Artifact deletion is a capability, not an assumption.** The Edge cache's
`invalidate()` can only be honest if the backend can actually delete/tombstone bytes.
Today `ArtifactStoreBackend.delete?()` is optional and `ArtifactBackendCapabilities`
has no `deletable`; `retention:'managed'` is suggestive but not normatively tied to
`delete()`. Add:

```ts
interface ArtifactBackendCapabilities {
  readonly writable: boolean;
  readonly deletable: boolean;        // NEW
  readonly acknowledge: WriteAckMode;
  readonly atomic: boolean;
  readonly retention: 'fixed' | 'managed' | 'none';
  readonly offlineReadable: boolean;
}
```

with `requirement.needsArtifactDelete?: boolean`. The Edge cache declares
`{ needsArtifacts: true, needsArtifactDelete: true }`, and construction fails when
`artifacts.capabilities.deletable === false`. Prefer explicit `deletable` over a
`retention:'managed' ⇒ delete() exists` implication: retention policy and the ability
to delete are related but not identical.

All capability/policy/configuration mismatches use `StorageError('unavailable')`.
`corrupt` remains reserved for genuinely damaged stored data and is never overloaded
for configuration errors. (A finer `capability-mismatch` code is possible later; not v1.)

### A.3.3 Scoped access

Scoped access goes through `createScopedStorage(adapter, scope)`, reusing the
prefix-scoping mechanism (`Namespace`). Scope is **collision-control, not
authorization** (RFC-007 §5). Scoped views:

- constrain `keys()` and `clear()` to the scope;
- **do not expose `close()`** — lifecycle belongs to the composition root that owns
  the injected adapter (multiple scoped views share one adapter);
- expose a **scoped CAS facade** (keys translated exactly like `get/set/remove`)
  when the underlying adapter is a `CasStore` — never the raw `CasStore`.

### A.3.4 Domain authority boundary

This port supplies the **underlying persistence** only where explicitly integrated.
It is not a substitute for a domain authority: `GrantUsageStore` (agent-policy
budgets/mandates), commerce replay/outbox, `WatermarkStore` (WOTS key-use), and
signing/recovery reservations keep their contracts and remain the single accounting
authority (RFC-007 §4.2 "Accounting authority", §3.6).

### A.3.5 Retention ≠ permission

A byte surviving restart does **not** imply access survives. Protected reads still
require entitlement freshness/revocation checks **above** the store. Revocation and
deletion stay separate decisions (RFC-007 §3.5, §5).

---

## A.4 Amendment phases

The original RFC-007 Phases 0–3 are recorded as **Landed** in §1.1; this amendment
uses its own labels to avoid collision.

| Label | Scope | Gate |
|---|---|---|
| **A0** | Neutral helpers + observable `failurePolicy` in `@totemsdk/storage`; two `EdgeRuntimePorts` slots. No behavior change. | Typecheck/lint; adapters and doubles report `failurePolicy`; helper unit tests. |
| **A1** | First consumer: Edge artifact cache in `@totemsdk/edge-adapters`, over `PersistencePorts`. | Write → **process restart/reopen** → retrieve; scope isolation (`get`/`keys`/`clear`); expiry/invalidation; `corrupt` vs `not-found`; capability/policy rejection. |
| **A2** | Conformance + required durable-CI job integration; reuse ProofGraph's `ArtifactStore` conformance result rather than duplicating. | CI job fails when a deployed-gate backend cannot run. |
| **A3** | Evidence-byte ownership: make the claim→artifact binding explicit; route captured originals through the ProofGraph evidence store; revisit chunking/GC in RFC-007 §4.3/OQ7. | Evidence restore test: commitment → resolvable artifact → bytes; `not-found` vs `corrupt`; byte-identity check. |

---

## A.5 Storage-free proof primitives (clarification, not a change)

Three layers are being merged when people say these packages are "storage-free";
only one of them was ever what that phrase meant:

1. **Commitment primitive** — `hash`, `merkle`, `manifest`, `claim`, `relations`.
   Pure functions over bytes in, digest/struct out. These **must** stay
   storage-free. Making `raster-proof` import `@totemsdk/storage` would couple the
   integrity primitive to a persistence vendor and violate the RFC-007 §4.1
   layering rule. "Storage-free" here means *the primitive does not own bytes*.
2. **Original bytes** — the raw GeoTIFF/thermal/LiDAR frame, the signed PDF, the
   GPS/IMU trace. An owner *exists* (ProofGraph's `ArtifactStore`-backed evidence
   store), but there is **no mandatory path** requiring capture/proof flows to route
   the bytes into it or to bind the claim → `contentHash` → `ArtifactRef`
   relationship. `RasterAssetRef` carries `uri?` + `contentHash` + optional
   `merkleRoot`/`chunkSizeBytes` (`packages/raster-proof/src/types.ts`), so a claim
   whose bytes are never resolvable remains constructible. This is the real gap (§A.6).
3. **Custody/index/graph** — who holds the bytes, where, retention, availability,
   and the claim↔bytes relationship. Partly ProofGraph, partly domain KV (§A.6.2).

`raster-proof`, `spatial-proof`, `location-proof` and `proof-integritas` are
layer-1 **commitment primitives** (`raster-proof/src/types.ts`: "No storage … It only
hashes bytes"). That property is correct and is retained: they are **not**
`ArtifactStore` consumers. Their bytes land in the layer-3 evidence store.

Do **not** add a `StorageAdapter`/`ArtifactStore` import to these packages. They need
only a way to **point** at their bytes. Two dependency-free options (choose one; the
amendment prefers the second):

1. Keep the existing `uri?` and define a resolvable convention
   (`totem-artifact://<namespace>/<algorithm>/<digest>`).
2. Add an optional structural `{ namespace, algorithm, digest }` binding to the
   **ProofGraph node `data`** (the `*Proofgraph.ts` helpers already build those
   nodes), keeping the proof types pure.

---

## A.6 Evidence-byte ownership and the original-data gap

### A.6.1 The lifecycle

```text
capture (edge/device)              → produces original bytes
  ├─ commit   (proof primitive)    → contentHash / merkleRoot committed into a claim
  ├─ retain   (ArtifactStore)      → bytes stored under namespace, digest-verified on read
  ├─ index    (KV / Journal)       → custody record: owner, location, retention, availability, uri
  └─ graph    (ProofGraph)         → node linking claim ⇄ artifact ⇄ downstream claims
```

RFC-007 supplies commit, graph, and part of retain/index. The defect is not a missing
owner but a missing **mandatory, verified binding**: the retain step exists yet is
optional, so the system can still produce an **unrecoverable commitment**.

### A.6.2 Ownership

| Layer | Owner | Surface | Guarantee |
|---|---|---|---|
| Commitment | proof primitive | none (pure) | Deterministic hash/manifest |
| **Original bytes** | **capture/ingest side (edge)** | `ArtifactStore` via `artifacts` port | Digest-verified on read; `strict` for evidence, `lenient` for rebuildable caches |
| Custody/index | owning domain | KV / `Journal` | Versioned; corruption surfaced per `failurePolicy` |
| Graph | `proofgraph` | evidence store | Consistent claim↔artifact binding |

The capture-time producer is the only party holding the bytes at capture, so the
`artifacts` port on the edge runtime is the correct byte sink. This is why the port
and the evidence gap are the same amendment.

**Key by, and enforce, the same `contentHash`.** `ArtifactStore` stores under
`ArtifactRef.digest = sha3_256(bytes)` and `ArtifactStore.get` re-verifies it, so the
mapping is `contentHash → ArtifactRef`; the evidence layer must **verify** that
binding, not merely record it. ProofGraph's `createProofGraphEvidenceStore` is the
reference binder and must reject mismatches for evidence-grade bytes (§A.6.4).

**Do not force `location-proof` / `spatial-proof` to store.** Their claims are
geometry/motion/confidence — small and often derived. They should **reference** the
raster/source artifacts, not duplicate bytes. Only packages that actually hold
captured originals are byte owners.

### A.6.3 Pointer requirement

For **evidence-grade** claims, a resolvable artifact binding (or an explicit
`external-uri` with a declared availability contract) must be **mandatory**. Today
`uri?` is optional, so an evidence claim with no recoverable bytes is constructible.
That is the defect this amendment closes.

### A.6.4 Enforce the binding (not just record it)

The byte-identity invariant must be **enforced** on the write path, not assumed:

```text
captured bytes
     ↓ sha3_256(bytes) = H
     ↓ expected contentHash from claim = H          MUST MATCH
     ↓ ArtifactStore.put(bytes) → ArtifactRef.digest = H   MUST MATCH same H
     ↓ ProofGraph binding: claim.contentHash === artifact.digest
```

Define an explicit binding and have the ProofGraph evidence helper reject mismatches:

```ts
export interface EvidenceArtifactBinding {
  readonly nodeId: string;
  readonly contentHash: string;   // the commitment from the claim
  readonly artifact: ArtifactRef; // ref.digest === contentHash
}
// invariant: binding.contentHash === binding.artifact.digest
// createProofGraphEvidenceStore MUST throw on mismatch (StorageError('corrupt'))
```

This yields the strong provenance statement

```text
claim ──commits to──► H
artifact ──addresses──► H
ProofGraph ──binds──► claim ↔ artifact
```

instead of the weaker `nodeId → some ArtifactRef` (roughly what the current evidence
index does). `raster-proof` already SHA3-256s the exact raw bytes, so the invariant
holds cleanly for captured originals.

---

## A.7 `ArtifactStore` consumer families

Selection rule — adopt `ArtifactStore` only where all hold:

1. Totem owns the bytes (not provider-owned, not on-chain).
2. Bytes are content-addressed / large (evidence or media), not small domain records.
3. Durability is declared (`strict` evidence vs `lenient`+`rebuildable` cache).
4. The package is a **byte owner**, not a hash producer.

| Priority | Consumer | Bytes owned | Disposition | Notes |
|---|---|---|---|---|
| **done** | `proofgraph` — `createProofGraphEvidenceStore(artifacts, index, …)` (`packages/proofgraph/src/evidence.ts:74`) | Evidence bytes for raster/spatial/location/integritas claims; flight-provenance chain | **Reference consumer** | Keystone: domains route evidence through it; do not open parallel stores. |
| **A1** | `edge-adapters` — Edge artifact cache | Edge-adjacent cached bytes | **First consumer of the injection point** | Must not depend on `@totemsdk/edge`. |
| **A3/P1** | `@totemsdk/edge` ↔ `@totemsdk/qvac` — generated inference outputs | TTS audio, `audioGen`, `video`, diffusion/upscale images (`intelligence/src/types.ts:162-166`) | **New consumer, highest value** | Provider-owned RAG/model caches stay behind QVAC ops; only Totem-generated outputs are retained, with the ref recorded in the existing usage journal/KV. |
| **P2** | `industrial-action` — work-order attachments, inspection media, receipt PDFs (`industrial-receipt.ts`, `edge-adapter.ts`) | Evidence media attached to lifecycle records | **New consumer** | Lifecycle record stays in `ActionStorage`; only bytes go to `ArtifactStore`, referenced by digest. Strict. |
| **P2** | `proof-integritas` — `report:pdf` output | PDF attestation reports | **New consumer (narrow)** | Provider produces; Totem retains. Strict if used as evidence; external `uri` may coexist. |
| **P3** | Firmware image distribution (`kissvm/templates/firmware-update.ts` hash only) | Firmware binaries | **Candidate domain** | Needs a domain owner package before adoption; large, content-addressed, integrity-bearing. |
| **Evaluate** | `recursive-mast` `encrypted-branch.ts` / `branch-capsule.ts` | Encrypted branch capsules | Probably KV | Move only if capsules carry large encrypted payloads. |
| **Evaluate** | Future RWA/legal/healthcare document vaults | Documents, imaging, BoL | No package yet | Templates only commit hashes; wait for a real byte-owning package. |

**Explicit non-consumers:** QVAC RAG/workspace/embedding/model storage (provider-owned);
the proof primitives (storage-free, §A.5); small domain records and reservations
(agent-policy, wots-lease, statechain, omnia-*, tx-builder, bonds) — stay on
KV/CAS/Journal; governance membership snapshots (signed domain artifacts); and any
template-only concern (KISSVM templates commit hashes, they do not retain bytes).

**Consumer priority.** ProofGraph is the anchor. The Edge cache is the injection
point's first consumer. Generated inference outputs are the highest-value next one,
then `industrial-action` evidence and Integritas reports. The proof primitives stay
storage-free and route through ProofGraph. Everything else stays on KV/CAS/Journal or
behind provider ops.

**Two architectural rules.** (1) Designate ProofGraph as the reference `ArtifactStore`
consumer and require `raster-proof`/`spatial-proof`/`location-proof`/`proof-integritas`
to route evidence through it — one conformance result reused by many, not a store per
domain. (2) One dependency direction: consumers depend on `@totemsdk/storage/artifacts`
(or `PersistencePorts`), never on `@totemsdk/edge`.

---

## A.8 Chunking, byte-identity, evidence vs telemetry

1. **OQ7 is reopened, not closed here.** Raster/LiDAR/thermal evidence establishes
   the first concrete requirement for chunked artifact retention
   (`RasterAssetRef` already carries `merkleRoot`/`chunkSizeBytes`). But this
   amendment does **not** ship a chunk-manifest/CAS/GC implementation: the
   chunked-artifact contract (`ChunkManifest`, `ChunkRef[]`, manifest digest,
   whole-object `contentHash`, range/chunk retrieval, partial-corruption handling,
   GC/reference ownership, atomic publication) must be specified in a **named
   follow-on phase/RFC before large-evidence production use**. It is not part of
   A0–A3. Folding it in here would turn a focused Edge persistence amendment into a
   full artifact-storage RFC.
2. **Byte-identity is a hard invariant.** The proof hashes the exact original bytes;
   `ArtifactStore.get` re-verifies `sha3_256(bytes)`. Capture must not transcode
   (compress, re-encode EXIF, normalise colour) between the proof hash and the
   artifact digest, or `contentHash ≠ ArtifactRef.digest` and the evidence is
   unrecoverable. This mirrors RFC-007's "codec never re-encodes committed bytes."
3. **Evidence vs telemetry is a declared classification.** Not every sensor reading
   is evidence. High-frequency telemetry should not become a ProofGraph node; it is
   operational, often derived/rebuildable, and belongs in a `lenient`/`rebuildable`
   cache. Only captured originals a claim commits to are `strict` evidence.
4. **Derived data is a cache.** NDVI, masks, upscales, resampled rasters are
   rebuildable from the original → `lenient`, `rebuildable: true`.

---

## A.9 Interfaces (declaration-only)

### `@totemsdk/storage` — new, provider-neutral

```ts
import type { ArtifactStore } from './artifacts/artifact-store.js';
import type {
  StorageAdapterWithCapabilities,
  StoreCapabilities,
  CasStore,
  FailurePolicy,
  WriteAckMode,
} from './types.js';

/** The two injectable persistence surfaces. */
export interface PersistencePorts {
  readonly storage?: StorageAdapterWithCapabilities;
  readonly artifacts?: ArtifactStore;
}

/** Scope identity. Namespacing avoids collisions only, NOT authorization (§5). */
export interface StorageScope {
  readonly principal: string;
  readonly adapter: string;
  readonly purpose: string;
  readonly domain?: string;
}

export interface PersistenceRequirement {
  /**
   * Not weakenable. `durable:true` ⇒ the required KV floor and the required artifact
   * floor are ALWAYS `'durably-acknowledged'`; an explicit non-durable
   * `acknowledge`/`artifactAcknowledge` alongside `durable:true` is a contradiction
   * and throws.
   */
  readonly durable: boolean;
  /** Desired KV floor. Meaningful when `durable:false` (or exactly the durable floor). */
  readonly acknowledge?: WriteAckMode;
  /** Desired artifact floor. Default: `acknowledge`. Meaningful when `durable:false`. */
  readonly artifactAcknowledge?: WriteAckMode;
  /** Requires atomic transactions (delegated to `assertCapabilities()`). */
  readonly atomic?: boolean;
  /** Requires conditional/CAS writes (delegated to `assertCapabilities()`); pairs with `ScopedStorage.cas`. */
  readonly conditional?: boolean;
  /** Required corruption policy. Default: 'strict'. */
  readonly failurePolicy?: FailurePolicy;
  /** Derivable content ⇒ corrupt may be rebuilt (lenient recovery). */
  readonly rebuildable?: boolean;
  /** Functional requirement, independent of `durable`. */
  readonly needsArtifacts?: boolean;
  /** Requires `artifacts.capabilities.deletable` (invalidation can actually delete). */
  readonly needsArtifactDelete?: boolean;
}

export interface PersistenceSurfaceGuarantee {
  /** `'none'` = no surface supplied; otherwise the supplied adapter's `WriteAckMode`. */
  readonly mode: 'none' | WriteAckMode;
}

export interface EffectivePersistence {
  readonly storage: PersistenceSurfaceGuarantee;
  readonly artifacts?: PersistenceSurfaceGuarantee;
  readonly failurePolicy: FailurePolicy;
  /** true only when EVERY required surface meets its required durability. */
  readonly durable: boolean;
}

/** Scoped, capability-preserving view. No close(); lifecycle owned by caller. */
export interface ScopedStorage extends StorageAdapterWithCapabilities {
  readonly scope: StorageScope;
  /** Scoped CAS facade; keys are scope-relative. Never the raw CasStore. */
  readonly cas?: CasStore;
}

export function createScopedStorage(
  adapter: StorageAdapterWithCapabilities,
  scope: StorageScope,
): ScopedStorage;

/**
 * Validate supplied ports against a declared requirement at construction.
 * Throws StorageError('unavailable') on any capability/policy/config mismatch.
 * Never downgrades silently.
 */
export function assertPersistence(
  ports: PersistencePorts,
  requirement: PersistenceRequirement,
  label: string,
): EffectivePersistence;
```

### `@totemsdk/edge` — `EdgeRuntimePorts` additions

```ts
import type { PersistencePorts } from '@totemsdk/storage';

export interface EdgeRuntimePorts {
  // …existing optional ports unchanged…
  /** Optional transactional KV substrate (RFC-007 §4.2). Required when a feature
   *  declares `durable`/`needsArtifacts`. */
  storage?: PersistencePorts['storage'];
  /** Optional artifact byte store (RFC-007 §4.3). Separate from `storage`. */
  artifacts?: PersistencePorts['artifacts'];
}
```

### `@totemsdk/edge-adapters` — first consumer (structural, storage-only types)

```ts
import type {
  ArtifactRef,
  ArtifactRead,
  ArtifactBackendCapabilities,
} from '@totemsdk/storage/artifacts';
import type {
  EffectivePersistence,
  PersistencePorts,
  PersistenceRequirement,
  StorageScope,
} from '@totemsdk/storage';

/**
 * Per-object cache policy. Deliberately does NOT reuse the `retention:
 * 'fixed'|'managed'|'none'` vocabulary: that is a BACKEND capability
 * (`ArtifactBackendCapabilities.retention`), not a per-object request.
 */
export interface ArtifactCacheRetentionPolicy {
  readonly ttlMs?: number;
  readonly invalidateOnExpiry?: boolean;
}

export interface EdgeArtifactCache {
  readonly capabilities: ArtifactBackendCapabilities;
  /** Reported after assertPersistence(); callers must never assume durability. */
  readonly effective: EffectivePersistence;

  put(scope: StorageScope, bytes: Uint8Array, policy?: ArtifactCacheRetentionPolicy): Promise<ArtifactRef>;
  get(scope: StorageScope, ref: ArtifactRef, policy?: ArtifactCacheRetentionPolicy): Promise<ArtifactRead>;
  invalidate(scope: StorageScope, ref: ArtifactRef): Promise<void>;

  // Entitlement/revocation deliberately NOT here — enforced above the store (§5).
}

export function createEdgeArtifactCache(
  ports: PersistencePorts,
  requirement: PersistenceRequirement,
  policy?: ArtifactCacheRetentionPolicy,
): EdgeArtifactCache;
```

---

## A.10 `assertPersistence` decision table

| Condition | Result |
|---|---|
| `durable:false`, no `storage` | `storage.mode:'none'` (no surface) |
| `durable:false`, `storage` present | `storage.mode = adapter.capabilities.acknowledge` (`volatile` for an in-memory store) |
| `durable:true`, no `storage` | **throw `unavailable`** |
| `durable:true`, `acknowledge` omitted | required floor = `'durably-acknowledged'` |
| `durable:true`, `acknowledge` explicitly `'volatile'`/`'buffered'` | **throw `unavailable`** (contradictory requirement) |
| `durable:true`, `adapter.acknowledge < 'durably-acknowledged'` | **throw `unavailable`** (no downgrade) |
| `atomic:true`, `adapter.capabilities.atomic === false` | **throw `unavailable`** (via `assertCapabilities`) |
| `conditional:true`, `adapter.capabilities.conditional === false` | **throw `unavailable`** (via `assertCapabilities`) |
| requested `failurePolicy:'strict'`, `adapter.failurePolicy==='lenient'` | **throw `unavailable`** (config, not `corrupt`) |
| `needsArtifacts:true`, no `artifacts` | **throw `unavailable`** |
| `needsArtifacts:true`, `artifacts.capabilities.writable === false` | **throw `unavailable`** |
| `needsArtifactDelete:true`, `artifacts.capabilities.deletable === false` | **throw `unavailable`** |
| `durable:true`, artifacts required, `artifacts.acknowledge < 'durably-acknowledged'` | **throw `unavailable`** |
| all required surfaces satisfied | `durable:true`; per-surface modes recorded |

`needsArtifacts` is independent of `durable`: `durable:false` means *persistence may
be ephemeral*, not that a required storage function may be absent. A consumer that can
operate with an in-memory artifact store must synthesise one and pass it through the
same port, reporting `artifacts.mode: 'volatile'`. `'none'` is reserved for "no
surface supplied"; `'volatile'` is the in-memory storage guarantee.

---

## A.11 Security, privacy & sovereignty

- **Retention ≠ permission** (§A.3.5): retained bytes do not imply retained access;
  entitlement/freshness checks stay above the store.
- **Privacy/encryption at rest.** Original imagery/footage may carry PII. Storage
  stays layer-neutral: either consumers encrypt before `put`, or an encrypted-envelope
  story is documented (cf. `recursive-mast/src/encryption-envelope.ts`). RFC-007 §5's
  rule that encrypted/sensitive records stay at their layer applies.
- **Availability is a per-stripe policy.** Evidence may need an explicit
  availability/offline policy (who retains, for how long), separate from content
  authorization.
- **Corruption is never fail-open.** `strict` surfaces surface `corrupt`; only
  declared-rebuildable caches may rebuild.
- **One conformance result, many consumers.** ProofGraph is the reference
  `ArtifactStore` consumer; other consumers reuse its conformance outcome rather than
  opening parallel "first consumer" tickets.

---

## A.12 Decisions confirmed

1. Two ports (`storage` + `artifacts`), not one.
2. Helpers live in `@totemsdk/storage`; Edge only exposes the two slots.
3. `durable:true` is **not weakenable**: the required KV and artifact floors are always
   `durably-acknowledged`; an explicit `volatile`/`buffered` alongside it throws
   (not merely "default to durable when omitted").
4. First consumer of the injection point = `@totemsdk/edge-adapters` (typed against
   `PersistencePorts`, no `@totemsdk/edge` dependency).
5. `failurePolicy` is a consumer requirement, enforceable only once
   `adapter.failurePolicy` is publicly observable (added here, outside `StoreCapabilities`).
6. Proof primitives stay storage-free; original bytes are owned by the capture/evidence
   layer (§A.5, §A.6), and the claim → `contentHash` → `ArtifactRef` binding is
   **enforced** (not just recorded) with `contentHash === artifact.digest`.
7. ProofGraph is the reference `ArtifactStore` consumer; raster/spatial/location
   primitives route evidence through it and do not depend on storage.
8. `assertPersistence()` is the single construction-time assertion and also covers
   `atomic` and `conditional`/CAS (delegating to `assertCapabilities`), not only
   acknowledgement.
9. `EffectivePersistence` distinguishes `'none'` (no surface) from the adapter's
   `WriteAckMode`; `'ephemeral'` is dropped (`volatile` already describes in-memory).
10. Artifact deletion is a declared capability (`deletable` + `needsArtifactDelete`);
    `invalidate()` is only claimed when the backend can actually delete.
11. Chunked artifact retention is a **follow-on** phase/RFC (OQ7 reopened), not A0–A3.

---

## A.13 Open questions

1. **Observable `failurePolicy` is a breaking interface change.** Confirm required
   member now (touching `MemoryStore`, adapters, doubles, conformance harness) rather
   than a deprecated `failurePolicy?` defaulting to `'strict'`.
2. **Evidence vs telemetry classification.** Which sensor classes are strict evidence
   vs lenient telemetry? This is a product/domain decision the architecture cannot make.
3. **Artifact floor.** Same acknowledgement floor for KV and artifacts, or a distinct
   `artifactAcknowledge`?
4. **Config-mismatch error code.** `unavailable` for all mismatches in v1, or reserve
   a later `capability-mismatch` code?
5. **`ScopedStorage.cas` exposure.** Surface a scoped `CasStore` facade, or defer CAS
   at the port for v1?
6. **Encryption envelope.** Encrypt-before-`put` at the consumer, or a documented
   artifact-layer envelope?
7. **Chunking is a follow-on, not A0–A3.** OQ7 is reopened by the raster/LiDAR
   evidence requirement, but the chunk-manifest/CAS/GC contract (shape, manifest
   digest, whole-object `contentHash`, range retrieval, partial corruption,
   reference ownership, atomic publication) must be specified in a **named follow-on
   phase/RFC** before large-evidence production use.

---

## A.14 Exact diff plan (on acceptance)

No implementation until explicitly approved. When approved, the landing is:

1. `packages/storage/src/persistence.ts` **(new)** — `PersistencePorts`,
   `StorageScope`, `PersistenceRequirement`, `PersistenceSurfaceGuarantee`,
   `EffectivePersistence`, `ScopedStorage`, `createScopedStorage`, `assertPersistence`.
2. `packages/storage/src/types.ts` — add `readonly failurePolicy: FailurePolicy` to
   `StorageAdapterWithCapabilities` (outside `StoreCapabilities`); export.
3. `packages/storage/src/artifacts/types.ts` — add `readonly deletable: boolean` to
   `ArtifactBackendCapabilities`; update `LocalFsBackend` and the backend conformance
   suite for `deletable`.
4. `packages/storage/src/adapters/{memory,file,sqlite,idb}-store.ts` — report
   `failurePolicy` (`MemoryStore:'strict'`); update the conformance harness and all
   test doubles.
5. `packages/edge/src/ports.ts` — add the two optional `EdgeRuntimePorts` slots.
6. `packages/edge-adapters/src/` — `EdgeArtifactCache` type +
   `createEdgeArtifactCache` skeleton (requirement
   `{ needsArtifacts:true, needsArtifactDelete:true }`) + conformance test (A1 gate).
7. `packages/proofgraph/src/evidence.ts` — **enforce** `EvidenceArtifactBinding`
   (`contentHash === artifact.digest`; reject mismatch) for evidence-grade bytes
   (A3 gate).
8. **Follow-on RFC/phase (not A0–A3).** Chunked-artifact contract — `ChunkManifest`,
   `ChunkRef[]`, manifest digest, whole-object `contentHash`, range/chunk retrieval,
   partial corruption, GC/reference ownership, atomic publication (OQ7 reopened).
9. `docs/rfc/RFC-007-STORAGE-CONSOLIDATION.md` — §1.1 status line and A-phase refs.

---

## A.15 References

- RFC-007 §1.1 (status), §3.5 (intelligence/QVAC boundaries), §3.6 (persistence
  matrix), §4.1 (DAG), §4.2 (deliverables, write-ack/failure policy), §4.3 (artifact
  boundary), §5 (security), §6 (phases), §7 (OQ7).
- `packages/storage/src/types.ts` (`StorageAdapterWithCapabilities`, `assertCapabilities`),
  `packages/storage/src/errors.ts`, `packages/storage/src/namespace.ts`,
  `packages/storage/src/artifacts/{artifact-store.ts,types.ts}`,
  `packages/storage/src/adapters/{file,sqlite,idb,memory}-store.ts`.
- `packages/edge/src/ports.ts` (`EdgeRuntimePorts`),
  `packages/edge/src/{runtime,intelligence-usage-journal}.ts`.
- `packages/edge-adapters/src/{sqlite-commerce-store,purchase-payment}.ts`.
- `packages/proofgraph/src/evidence.ts` (`createProofGraphEvidenceStore`).
- `packages/{raster,spatial,location}-proof`, `packages/proof-integritas`.
- `packages/intelligence/src/types.ts` (stream chunks), `packages/qvac/src/api-snapshot.ts`.
- Integration precedent: `packages/industrial-action/src/{approvals,events,locks}.ts`,
  `packages/edge-mqtt/src/durable-queue.ts`.
