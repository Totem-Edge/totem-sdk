# RFC-057 — Distributed Storage and Replication (Holepunch Integration)

Status: Draft — Phase 0 (repair + conformance) **complete**; Phase 1 (replicated logs and indexes) **complete** (`@totemsdk/replication`, `@totemsdk/replication-holepunch`). Phases 2–5 authorised for staged implementation; Hyperdrive artifacts, Autobase, production consumers and deployment hardening remain
Created: 2026-10-20
Authors: Totem SDK Contributors
Depends on: RFC-007 (Storage Architecture), RFC-031 (Bare/ESM portability), RFC-037 (unified WOTS identity)
References: `docs/audits/bare-bun-readiness-2026-10.md`, the Holepunch integration review (2026-10-20)
Touches: **new** `@totemsdk/replication`, **new** `@totemsdk/replication-holepunch`; references `storage`, `pear`, `stream-transport`, `proofgraph`, `identity`, `authority`

> **Positioning.** Totem already has P2P transport, a neutral storage contract and a
> thin Hyperdrive adapter. It does not have a replicated-storage layer. This RFC
> proposes one, but deliberately keeps **local transactional persistence**,
> **verifiable replication** and **collaborative state** as three different
> capabilities. Hypercore, Hyperbee, Autobase and Hyperdrive extend Totem storage;
> they do not replace SQLite, CAS journals or Minima finality.
>
> Phase 0 is authorised because the existing Holepunch adapters have correctness
> bugs that must be fixed before any new API is built on them. Phases 1–5 are
> proposals pending review.

---

## 1. Current state (verified)

The repository has **66 publishable packages** (72 discovered workspace packages).
Holepunch is already present, but in several unrelated integration pockets. The
table covers the integration-relevant packages; declarative/metadata-only mentions
(identity service endpoints, manifest endpoints, recursive-MAST policy endpoints,
edge capabilities, browser wallets) are listed in §1.2.

| Area | What exists | Gap |
|---|---|---|
| `@totemsdk/stream-transport` | `IStreamTransport`, `HyperswarmStreamTransport`, WebSocket adapters | Message transport only; each call creates its own swarm, no replication sessions or ownership |
| `@totemsdk/omnia` | Hyperswarm/HyperDHT swarm, peer identity, rendezvous, `createOmniaSwarmFromInstance()` | Payment messaging; independent swarm lifecycle; the injection seam exists but is not used by a shared manager |
| `@totemsdk/omnia-relay` | Browser-safe relay transport and relay-backed swarms | Non-Holepunch fallback; no replication-over-relay path |
| `@totemsdk/lookup-node` | Hyperswarm-connected lookup service | Legacy `join` options; independent swarm lifecycle |
| `@totemsdk/lookup-client` | Hyperswarm transport with WebSocket fallback, provider/client wrappers | Duplicates the per-call swarm/listener defects; no peer matching or cleanup |
| `@totemsdk/lookup-protocol` | Lookup wire messages, including manifest `retrievalEndpoints` | Retrieval endpoints exist but carry no dataset/version/digest or replication semantics |
| `@totemsdk/chain-provider` | `LookupClientProvider` over `lookup-client` | Indirect consumer; would benefit from replicated read replicas |
| `@totemsdk/realtime` | `LookupBackend` over `lookup-client` | Indirect consumer; freshness/`complete` semantics are undefined |
| `@totemsdk/pear` | `BareHyperswarm`, `BareKVStore` (Hypercore + Hyperbee), `BareFileStore`, `openRemoteDrive`, `loadManifest` | No shared connection manager; mocked-only replication tests; the `storage`/`network`/`hyperdrive` subpaths must stay compatible |
| `@totemsdk/storage` | SQLite/FS/IDB/memory adapters, CAS snapshots, durable journal, `ArtifactStore`, conformance harness | Runtime-neutral; no replication vocabulary |
| `@totemsdk/qvac` | Vendored QVAC `downloadAsset({ hyperdriveKey })` surface | External Hyperdrive downloader; no Totem digest verification or `ArtifactStoreBackend` |
| `@totemsdk/edge-mqtt` | `transport.kind: 'hyperswarm'` | Metadata only; no swarm is created by this package |
| `@totemsdk/edge`, `connect`, `wallet-adapter` | Capability flags `chain:hyperswarm`, `omnia:hyperswarm`, `transport:hyperswarm` | Declarative only; browser wallets cannot use native Holepunch |
| `extensions/totem-pear-android-starter` | Bare/Pear reference app with Hypercore/Hyperbee peers; hosted-relay Omnia | Stale `@totemsdk/omnia-hyperswarm` import; must be migrated and used as a compatibility fixture |
| `packages/sdk-tests` | Private cross-package integration harness | Natural home for multi-peer conformance tests |

`@totemsdk/storage` is intentionally runtime-neutral (no Hypercore, Pear or network
dependencies) and is a dependency of ~26 packages. That property is load-bearing
for RFC-007 and must survive this work.

### 1.1 Confirmed defects in the existing Holepunch integrations

These are source-level findings. They are not the result of a live multi-peer run.

| # | Location | Finding | Required correction |
|---|---|---|---|
| D1 | `packages/lookup-node/src/hyperswarm-manager.ts:160` | `swarm.join(topic, { announce, lookup })` uses the legacy option names. Current Hyperswarm expects `{ server, client }`; disabling announcement or lookup may not do what the caller intended. | Map config to `{ server: announce, client: lookup }` explicitly and add a test. |
| D2 | `packages/pear/src/network/hyperswarm.ts:60-80` | `BareHyperswarm.connect()` registers a fresh `connection` listener on every call, does not match the expected topic/peer, does not remove the listener on timeout, and resolves on any inbound connection. | Match topic/public key, register once, clean up on timeout, and reuse `stream-transport`'s `targetPublicKey` filter (`packages/stream-transport/src/index.ts:781`). |
| D3 | `packages/pear/src/hyperdrive.ts:187` | `openRemoteDrive()` joins the **root public key** as the discovery topic. Standard Hyperdrive replication discovers peers via `drive.discoveryKey`; a custom topic only works if both sides deliberately agree. | Join `drive.discoveryKey`; keep the root key for `new Hyperdrive(store, key)`. Add a publisher/reader two-process test. |
| D4 | `packages/pear/src/hyperdrive.ts:190-200` | `swarm.flush()` is used as proof that a peer was found. `flush()` only completes the announce/lookup phase. | Wait for a `connection` (or a core `update`/`download`) with a timeout; never treat `flush()` as readiness. |
| D5 | `packages/pear/src/hyperdrive.ts:228-245` | `loadManifest()` dynamically imports `@totemsdk/app-manifest`, which does not exist (the canonical package is `@totemsdk/manifest`), and the catch-all returns raw parsed JSON on decode/schema failure. | Use `@totemsdk/manifest`'s decoder/verifier and **fail closed**. Distinguish "no decoder" from "invalid manifest". |
| D6 | `packages/pear/src/hyperdrive.ts:233` | A drive opened internally by `loadManifest()` is never closed. | Close in `finally` when the function owns the drive. |
| D7 | `packages/pear/src/storage/BareKVStore.ts` | Uses `valueEncoding: 'json'`, not the Totem versioned codec, so `bigint`/bytes behaviour differs across adapters. | Use the shared `@totemsdk/storage` codec; keep the on-disk format versioned. |
| D8 | `packages/pear/src/__tests__/storage.test.ts` | `BareKVStore` tests inject a mocked Hyperbee. They prove the wrapper, not Hypercore persistence or replication. | Add real Hypercore/Hyperbee integration and multi-peer replication tests (Node and Bare). |
| D9 | `packages/pear/src/hyperdrive.ts:105-110` | `watch()` uses a callback-style API. Current Hyperdrive releases expose an async watcher iterator; the callback form is at best version-dependent. | Pin the supported Hyperdrive range and use the documented watcher interface; add a change-detection test. |
| D10 | `packages/lookup-client/src/transport.ts:349-369` | The lookup client repeats the D2 pattern: a new swarm and a fresh `connection` listener per call, no expected peer/topic matching, no listener removal on timeout, and no `swarm.destroy()` when the attempt fails. | Move to the shared connection manager; match the lookup node’s public key/topic; destroy the swarm on failure. |
| D11 | `packages/stream-transport/src/index.ts:761-787` | `createHyperswarmTransport()` creates a new swarm per call, has no timeout, uses `swarm.flush()` as readiness, and never destroys the swarm. The returned `HyperswarmStreamTransport.close()` closes the socket only. | Own the swarm in a connection manager or return a handle whose `close()` also leaves/destroys the swarm; test teardown and timeout. |
| D12 | `packages/pear/src/__tests__/bare/storage.bare.mjs:78-95` | The Bare KV tests also inject an in-memory Hyperbee mock, so Bare coverage does not prove Hypercore persistence or replication either. | Add real Hypercore/Hyperbee tests under Bare and Node (extends D8). |
| D13 | `extensions/totem-pear-android-starter/src/omnia/channelManager.js:24` | The first-party Pear Android starter imports `@totemsdk/omnia-hyperswarm`, which no longer exists (the current package is `@totemsdk/omnia`), and documents hosted relay because native Hyperswarm is unavailable on Android. | Migrate it to `@totemsdk/omnia` + `@totemsdk/pear`; keep it as the Android/Bare compatibility fixture for Phase 0/1. |

`@totemsdk/omnia` and `@totemsdk/stream-transport` already use `{ server, client }`
correctly (`packages/omnia/src/swarm.ts:227`,
`packages/stream-transport/src/index.ts:781`), so D1, D2 and D10 are local defects,
not a framework-wide convention change.

### 1.2 Explicit non-integrations

These are intentionally out of scope for the replication layer. They are listed so
that “no change” is a decision, not an omission:

- **Browser wallets/extensions** (`connect`, `wallet-adapter`,
  `extensions/totem-extension`, `extensions/totem-pwa-wallet`): they only declare
  `hyperswarm` capabilities. Native Holepunch transport is unavailable in their
  runtime; replication, if needed, must go through a relay/gateway.
- **`edge-mqtt`**: `transport.kind: 'hyperswarm'` is metadata for device
  configuration. The package does not create a swarm and must not gain a storage
  dependency.
- **`pubsub-transport`**: in-process event fan-out, not a P2P replication layer.
- **`recursive-mast`**: `PolicyEndpoint.transport: 'hyperswarm'` is declarative
  policy metadata, not a swarm implementation. The shared connection manager
  should remain reusable by a future policy-endpoint caller.
- **`edge-mqtt`**: the README describes a Hyperswarm topic “used as an MQTT
  channel”, but the implementation accepts `kind: 'hyperswarm'` as metadata only
  (`src/__tests__/gateway.test.ts:104-117`). Correct the docs or treat it as a
  future transport, not a storage integration.
- **`identity` service endpoints, `manifest` endpoints, `lookup-protocol`
  `retrievalEndpoints`**: these are the natural announcement surfaces for
  replicated datasets. Phase 4 should reuse them rather than invent a parallel
  discovery mechanism.
- **`mcp-server`**: documentation/index metadata only.
- **`core`, `core-wasm`, `tx-builder`, `minima-rpc`, `kissvm`, `txpow`, `eefi`**:
  no storage replication; they remain sources of validity, schemas or execution,
  not replication participants.
- **`root-identity`**: proof generation/verification only. Proof artifacts may be
  published through `ArtifactStore`; the wallet/key surface is not replicated.
- **Minima finality**: never replaced by replication checkpoints. Anchoring a
  checkpoint through `proof-integritas` is optional evidence, not settlement.
- **`authority`, `provider-bond`, `liquidity-bond`**: no mandatory replication.
  Optional replicated caches/registry copies MAY be added later, but local CAS
  and authority verification remain authoritative.

The only packages that MUST change in Phase 0 are `pear`, `lookup-client`,
`lookup-node`, `stream-transport` and the Pear Android starter fixture. All other
packages are consumers added in later phases.

---

## 2. Architectural boundaries

### 2.1 Three different guarantees

| Capability | Source of truth | Allowed failure semantics |
|---|---|---|
| Local transactional persistence | SQLite / FS / memory adapter + CAS journal | atomic, conditional, durably acknowledged (RFC-007) |
| Verifiable replication | Hypercore append-only log + signed checkpoints | eventually replicated; local append ≠ remote acknowledgement |
| Collaborative state | Autobase deterministic reducer + materialised Hyperbee view | eventually convergent; **never** global finality |

A replicated record may be locally durable, remotely unreplicated, or superseded.
A collaborative view may be complete for one peer and incomplete for another.
None of these is equivalent to Minima settlement or Omnia channel validity.

### 2.2 Authority stays outside replication

Hyperswarm's Noise key proves control of a connection key. It does **not** prove
the Totem identity in a manifest, and it does **not** authorise a writer. Writer
admission MUST be bound to `@totemsdk/identity` / `@totemsdk/authority` with a
signed, versioned writer set. This mirrors the Omnia lesson: a transport key is a
routing label; the PQ binding is the signed manifest (`transportPubkey`).

### 2.3 Omnia is not a storage consumer of last resort

Autobase MUST NOT become the authoritative state machine for channels, VTXOs,
factories or liquidity reservations. Those have protocol-specific signing,
ordering, double-spend and recovery invariants. Replication may carry encrypted
backups, recovery packages and receipts of **already validated** state only.

---

## 3. Package placement

The review proposed putting Holepunch adapters under `@totemsdk/storage`
(`storage/holepunch/*`). This RFC rejects that placement for three reasons:

1. `@totemsdk/storage` is runtime-neutral and depended on by ~26 packages. Adding
   optional Hypercore/Pear peers changes resolution and pack behaviour for all of
   them, even when the subpath is unused.
2. RFC-007's neutral root import must not acquire native/P2P runtime dependencies.
   An optional subpath is better than a root dependency, but a separate package is
   stronger: consumers opt in explicitly and the peer matrix stays honest.
3. Bare, Node and browser support differ for Hypercore/Hyperdrive. Keeping the
   adapters separate allows a package-level support matrix instead of conditional
   runtime branches.

Proposed packages:

| Package | Contents | Runtime |
|---|---|---|
| `@totemsdk/replication` | Contracts only: `DistributedCapabilities`, `ReplicationStatus`, `ReplicatedLog`, `CollaborativeStore`, dataset descriptors, checkpoints, conformance harness | Runtime-neutral, no Holepunch dependency |
| `@totemsdk/replication-holepunch` | Hypercore/Hyperbee/Autobase/Hyperdrive/Corestore adapters and the shared replication service | Optional peer dependencies |
| `@totemsdk/pear` | Runtime lifecycle + compatibility re-exports (`/storage`, `/hyperdrive`, `/network`) | Bare/Pear |

`@totemsdk/stream-transport` remains the home for message transport. It MAY host a
connection manager (discovery, topic join, peer admission, lifecycle), but it MUST
NOT expose `IStreamTransport.send()` as the replication path.

> **Why not reuse `IStreamTransport` for replication?** Hypercore replication is a
> length-prefixed duplex protocol with its own flow control. Wrapping it in
> message frames risks head-of-line blocking, backpressure loss and protocol
> interference. Share the swarm/connection manager; hand raw connections to
> `corestore.replicate()`. Use a protocol mux (e.g. Protomux) only when messages
> and replication must share one physical socket.

---

## 4. Contracts (proposal)

The existing `StoreCapabilities` (`packages/storage/src/types.ts:21`) describes
local persistence only. It MUST NOT grow a `replicated: boolean`. Distributed
consumers get a separate contract:

```ts
export interface ReplicationStatus {
  readonly connectedPeers: number;
  readonly localHead: string | null;
  readonly observedHeads: ReadonlyArray<{ peerId: string; head: string; signature?: string }>;
  readonly syncing: boolean;
  readonly lastUpdateAt?: number;
}

export interface DistributedCapabilities {
  readonly model: 'single-writer' | 'multi-writer' | 'read-replica';
  readonly historicalReads: boolean;
  readonly sparseReplication: boolean;
  readonly encrypted: boolean;
  readonly authenticatedWriters: boolean;
}

export interface ReplicatedLog<T> {
  append(record: T): Promise<{ length: number; head: string }>;
  readSince(cursor?: string): AsyncIterable<{ cursor: string; record: T }>;
  status(): ReplicationStatus;
  close(): Promise<void>;
}

export interface CollaborativeStore<Op, State> {
  propose(operation: Op): Promise<{ id: string; status: 'queued' | 'applied' }>;
  readView(): Promise<{ state: State; revision: string; complete: boolean }>;
  status(): ReplicationStatus;
  close(): Promise<void>;
}
```

Rules:

- `localHead`/`observedHeads` are opaque, verified checkpoint identifiers, not
  "the latest block is final".
- `complete` reports whether the local view has all operations the peer knows
  about; it is not a finality claim.
- `append()` success means **locally persisted**, never "replicated".
- A consumer that needs atomicity MUST require `StoreCapabilities` from the local
  adapter; a replicated view is never a substitute.

### 4.1 Dataset descriptors

Every replicated dataset MUST declare:

- dataset id and version;
- schema / codec version (Totem's versioned codec, not raw JSON);
- writer model and authenticated writer-set reference;
- encryption profile (or `none`);
- retention/sparse policy;
- migration rules for older peers.

Unknown dataset versions MUST be rejected, not best-effort parsed.

---

## 5. Placement of each primitive

| Primitive | Contract | Adapter | Primary use |
|---|---|---|---|
| Hypercore | `ReplicatedLog` | `replication-holepunch/hypercore` | signed event histories, receipts, telemetry |
| Hyperbee | `DistributedIndex` (read-mostly) | `replication-holepunch/hyperbee` | searchable indexes, read models, caches |
| Autobase | `CollaborativeStore` | `replication-holepunch/autobase` | governed multi-writer registries and curation |
| Hyperdrive | `DistributedFileStore` + `ArtifactStoreBackend` | `replication-holepunch/hyperdrive` | evidence bytes, model/firmware distribution |
| Corestore | shared session/namespace manager | `replication-holepunch/corestore` | core lifecycle, namespaces, storage layout |
| Hyperswarm | connection/discovery manager | `stream-transport` + `pear/network` | topic join, peer admission, replication sessions |
| Autobee | optional adapter | `replication-holepunch/autobase` | convenience KV over Autobase (experimental upstream) |

Hyperbee is single-writer at the log level. A read-only replica MUST expose a
read-oriented interface, not a writable `StorageAdapter`. Multi-writer state is
Autobase's job.

### 5.1 Hyperdrive → `ArtifactStore`

`@totemsdk/storage` already enforces SHA3-256 digest verification on artifact
reads (`packages/storage/src/artifacts/`). A Hyperdrive backend MUST:

- use immutable paths derived from `ArtifactRef` (not mutable filesystem paths);
- verify retrieved bytes against the expected digest before returning;
- distinguish "not found" from "corrupt/unverified";
- never rewrite a previously published evidence path.

Hyperdrive's keys and versions are not Totem `ArtifactRef`s; the adapter maps
between them.

---

## 6. Security and consistency requirements

| Requirement | Reason |
|---|---|
| Deterministic Autobase reducers | all peers must derive identical views from the same operation history |
| Verified writer membership | possession of a dataset/connection key is not write authority |
| Separated local durability / remote acknowledgement / application finality | a local append may exist nowhere else |
| Explicit freshness/`complete` reporting | a valid view may be incomplete |
| End-to-end encryption for private datasets | Hyperswarm transport encryption does not protect stored replicas |
| Dataset versioning and migration | old peers must not silently reinterpret newer schemas |
| Memory/disk/connection quotas | untrusted replication must not exhaust edge devices |
| Immutable evidence references | distributed filesystem changes must not rewrite history |
| No implicit global finality | convergence is not settlement |
| Key rotation/revocation semantics | revoking future access cannot erase existing copies |

Additionally:

- Replication MUST report `durably-acknowledged` only after crash-recovery tests
  prove the runtime/backend meets RFC-007's guarantee. Until then, Hypercore and
  Hyperbee adapters report `buffered` or `volatile`.
- Read access policy is separate from write admission. A dataset key alone does
  not grant read access to encrypted content.
- A peer's observed head MUST be authenticated (signature or verified log
  identity) before it is used for a checkpoint comparison.

---

## 7. Implementation phases

### Phase 0 — repair and prove the foundation (authorised)

1. Fix D1–D13.
2. Add a shared Corestore/connection lifecycle with explicit ownership, used by
   `@totemsdk/pear`, `@totemsdk/lookup-client` and
   `@totemsdk/stream-transport`. `@totemsdk/omnia` keeps its own swarm but MUST be
   able to consume the shared manager through `createOmniaSwarmFromInstance()`.
3. Add real multi-process integration tests: publisher/reader Hyperdrive, two-peer
   Hypercore/Hyperbee replication, offline write + reconnect. Node **and** Bare
   must use real Holepunch components (D8/D12).
4. Keep all existing `@totemsdk/pear` subpath imports working
   (`/storage`, `/network`, `/hyperdrive`, `/lifecycle`).
5. Migrate the Pear Android starter to the current packages (D13) or explicitly
   mark it stale; use it as the Android/Bare compatibility fixture.

**Gate:** Node and Bare both pass the two-process tests; no mocked-Hyperbee test is
the sole coverage for replication; lookup-client and stream-transport pass
teardown/timeout tests.

### Phase 1 — replicated logs and indexes

Implement `@totemsdk/replication` contracts and the Hypercore/Hyperbee adapters:
dataset descriptors, codec, capability declarations, replication status. No
Autobase.

Move `BareKVStore` to the shared Totem codec (D7) while keeping the
`@totemsdk/pear/storage` compatibility entry point.

**Gate:** single-writer durability, sparse replication, restart recovery, version
rejection, and cursor semantics tested against real Hypercore.

### Phase 2 — Hyperdrive artifacts

Generalise the existing adapter and implement `ArtifactStoreBackend`: digest
verification, immutable paths, cache/lifecycle, interrupted download recovery.
Migrate the QVAC `downloadAsset({ hyperdriveKey })` surface to the same backend
(or document a bridge) so model assets get Totem digest verification. Proof
artifact producers (`location-proof`, `spatial-proof`, `raster-proof`) publish
through `ArtifactStore`, not ad-hoc paths.

**Gate:** artifact conformance harness passes against the Hyperdrive backend;
corrupt-block and interrupted-download tests fail closed.

### Phase 3 — Autobase collaborative state

Deterministic reducers, governed writer admission, identity binding, dataset
migration, offline convergence tests. Hyperbee provides materialised views.

**Gate:** competing writers converge; unauthorised writers are rejected; a peer
with a stale view never reports `complete`.

### Phase 4 — first production consumers

Proofgraph evidence network, device event histories, replicated manifests, and
selective agent receipts. Existing authoritative CAS state is preserved.

Also integrate the read-side consumers: `lookup-client`/`chain-provider`/
`realtime` read replicas and caches, `lookup-protocol` replication capability
announcements, optional `proof-integritas` checkpoint anchoring, and any
replication actions exposed through the `edge` action registry (with dataset-key
rotation and raw writer-set changes on the ungrantable list).

**Gate:** end-to-end proofgraph evidence flow with independent verification;
replicated lookup reads report freshness/`complete` and never silently fall back
to stale data.

### Phase 5 — deployment hardening

Encrypted dataset distribution, quotas, selective replication, verified
checkpoints, recovery across Node, Bare and constrained ARM. Add a
replication-over-relay path for runtimes without native Holepunch (browser,
Android Pear) via `@totemsdk/omnia-relay` or a dedicated gateway; native
Hyperswarm remains the preferred path.

**Gate:** process kill during append, key rotation, dataset-version
incompatibility, relay replication round-trip, and ARM64 resource measurements.

---

## 8. Consumer priorities

| Consumer | Integration | Priority |
|---|---|---|
| `proofgraph` + `proof` + `proof-integritas` | Hypercore event history, Hyperbee indexes, Hyperdrive evidence, optional checkpoint anchors | High |
| `edge` + `industrial-action` + `edge-*` connectors (`edge-adapters`, `edge-bacnet`, `edge-ble`, `edge-can`, `edge-coap`, `edge-email`, `edge-grpc`, `edge-lorawan`, `edge-matter`, `edge-modbus`, `edge-nfc`, `edge-opcua`, `edge-ros2`) | offline telemetry, device registries, operational logs (connectors are producers only) | High |
| `identity` + `manifest` + `entity` + `root-identity` | replicated discovery indexes and manifests; entity views and root proofs as artifacts | High |
| `pear` + Android starter | reference adapters, runtime lifecycle, compatibility fixture | High |
| `lookup-node` + `lookup-client` + `chain-provider` + `realtime` | secondary read replicas, portable caches, freshness reporting | High/Medium |
| `location-proof` + `spatial-proof` + `raster-proof` | evidence artifact publication/retrieval via `ArtifactStoreBackend` | Medium |
| `decision` + `agent-policy` | reproducible proposal/receipt histories (non-authoritative) | Medium |
| `qvac` + `intelligence` | verified model/dataset distribution via the shared artifact backend | Medium |
| `governance` | collaborative proposals and voting records, with external finality | Medium |
| `edge` action registry | governed replication actions and capability names | Medium |
| `server` | optional settlement/receipt audit logs | Low/Medium |
| `authority` + `provider-bond` + `liquidity-bond` | optional replicated caches/registry copies; local CAS and verification remain authoritative | Selective |
| `omnia` family (`omnia`, `omnia-factory`, `omnia-host`, `omnia-pool`, `omnia-router`, `omnia-splice`, `omnia-vtxo`) | encrypted backups/recovery of validated state only | Selective |
| `statechain` + `se-server` + `wots-lease` | encrypted backup/recovery, never replacing local CAS authority | Selective |
| `connect`, `wallet-adapter`, browser extensions | relay/gateway replication only; native Holepunch is out of scope | Selective |

The first end-to-end target is a **governed, offline-first, multi-device evidence
network** (proofgraph + Hypercore + Hyperbee + Hyperdrive, Autobase later). It
exercises the primitives without putting payment correctness at risk.

---

## 9. Non-goals

- Replacing SQLite/CAS/local journals.
- A consensus protocol, global ordering or chain finality.
- Making Autobase authoritative for Omnia, statechain or WOTS leases.
- Moving message transport into Corestore or vice versa.
- Generic "database" APIs that hide durability, freshness and authority
  differences behind one interface.
- A browser-first replication stack in this RFC (browser support is future work).

---

## 10. Open questions

1. Should the contracts live in `@totemsdk/replication` or as an optional subpath
   of `@totemsdk/storage`? This RFC prefers a separate package; the final decision
   should be made before Phase 1.
2. Which Hyperdrive/Hypercore major ranges are supported on Bare 1.35 and Node 22?
   Pin explicit ranges and test both.
3. Does Autobase writer admission need an on-chain anchor, or is a signed
   manifest/authority mandate sufficient for the first consumers?
4. What is the checkpoint signature domain and rotation story?
5. How do encrypted datasets handle key rotation for peers that already replicated
   old blocks?
6. Should `observedHeads` expose peer identities publicly, or only opaque refs?
7. Is replication-over-relay (for Android Pear, browser wallets or constrained
   devices without native Hyperswarm) part of this RFC or a separate transport
   RFC? `@totemsdk/omnia-relay` is the existing candidate carrier.
8. Does `@totemsdk/lookup-protocol` need explicit replication capability/dataset
   announcements, or should replicated lookup replicas be discovered out of band?
9. Should QVAC delegate Hyperdrive downloads to `ArtifactStoreBackend`, or keep
   its vendored downloader and expose only a verification bridge?
10. Which replication actions should the `@totemsdk/edge` action registry expose,
    and which (raw writer-set changes, dataset-key rotation, checkpoint override)
    belong on the ungrantable list?
11. Should `@totemsdk/server` and `@totemsdk/proof-integritas` anchor checkpoints
    in this RFC, or is that a separate evidence/anchoring RFC?
12. Should `lookup-protocol` `retrievalEndpoints` carry dataset id, version,
    digest and replication capability, or should that live in the manifest
    endpoint record instead?

---

## 11. Authorisation

**Authorisation update 2026-10-27.** Phase 0 is complete. The repository owner
authorised staged implementation of Phases 1–5. Phase 1 has landed with the new
`@totemsdk/replication` contracts package and the optional
`@totemsdk/replication-holepunch` adapters (Hypercore log, Hyperbee read index).
Phases 2–5 remain gated by their own acceptance tests. No change is authorised to
Omnia/statechain/WOTS authority: replication may carry encrypted backups of
already validated state only.
