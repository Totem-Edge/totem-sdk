# RFC-007: Storage Consolidation & Durable Guarantees

**Status:** Draft
**Created:** 2026-09-15
**Authors:** Totem SDK Contributors
**Reviewers:** [Pending stakeholder assignment]

---

## 1. Summary

Totem does not need persistence invented from scratch. A source-level audit of the
workspace (at `e97b2c1`, confirmed against `origin/main`) found that the durable,
transactional machinery we need already exists across the codebase: an
`SQLiteCommerceStore` covering all five commerce contracts, a `SqliteRunStateStore`
covering bounded autonomous execution, and a generic `StorageAdapter` interface in
`@totemsdk/core`. What is missing is **one consistent contract for durability,
atomicity, isolation, recovery, and lifecycle**, plus a handful of verified gaps.

This RFC does **not** introduce a new generic persistence model. It:

1. Introduces a thin contract layer, `@totemsdk/storage`, that *unifies* the
   existing interfaces (one base interface, one error taxonomy, one codec, one
   transaction primitive, one conformance harness).
2. Consolidates the two existing transactional backends (commerce, run-state) onto
   those shared primitives without inventing a second reservation/nonce/
   accounting system.
3. Hardens the runtime adapters (file/JSON stores) whose `corrupt = absent`
   semantics are unsafe for signing history.
4. Fills the verified durability gaps (WOTS journal, MQTT delivery, memory-only
   domain registries, purchase-payment idempotency, interface-only storage ports).
5. Records a package-by-package persistence disposition — **Migrate / Retain /
   Delegate / Ephemeral / Defer+consequence** — for every entry in `SDK_MANIFEST`
   (60 packages), with per-surface owners, guarantees, and acceptance gates
   (§3.6), so "who owns what, how it may fail, and how it is verified" is
   answerable for the whole SDK.

The SDK is **pre-release**: nothing in this RFC preserves backwards compatibility.
We unify and dissolve freely, with one hard external constraint — hashing stays in
`@totemsdk/core` (it underwrites blockchain transactions unrelated to storage), and
the storage layer depends on core one-way, never the reverse.

## 2. Motivation

### 2.1 The problem is guarantees, not absence

Nearly every durable surface already exists. The fragmentation is in *semantics*:

| Behavior | Where it lives today | Problem |
|----------|---------------------|---------|
| Corrupt JSON → `null` | `server.FileStorageAdapter.get`, omnia `JsonFileStorageAdapter.get` | Callers can't tell *not found* from *corrupt* |
| Corrupt JSON → empty store | Pear `BareFileStore._ensureLoaded` | Fail-open: prior data silently lost |
| Flush failure swallowed | Pear `BareFileStore._scheduledFlush` | Data lives only in RAM until process exit |
| `clear()` ignores prefix | `server.FileStorageAdapter.clear` | Nukes every `.json` in the shared directory |
| `keys()` not prefix-filtered | `server.FileStorageAdapter.keys` | Returns foreign prefixes' keys with prefix stripped |
| Two key-value interfaces | `core.StorageAdapter` vs `tx-builder.KeyValueStorage` | Split-brain base contract |
| Codec differences | bigint tagged (`omnia`) vs bigint-as-string (elsewhere); bare `JSON.stringify` throws on bigint (`server`) | No portable serialization |
| In-memory step before publish | MQTT offline queue `dequeue()` → `publish()` | Crash window loses the message |
| Process-local replay cache | MQTT `command-handler` `Set` (60s TTL) | Replay protection resets on restart |
| O(n²) journal rewrite | WOTS `LeaseJournal.append` | Whole-array write per entry |
| Result-cache idempotency only | `createPurchasePaymentAdapter.pay` | No atomic claim before the external port → double-pay risk |

The existing *good* primitives are the seeds of the standard:
`SQLiteCommerceStore.transitionAndEnqueue` already does revision-CAS + outbox
enqueue in one transaction; agent-policy's `autonomy_*` tables already model
reservations, receipts, nonces, mandate usage, expiry, and budget accounting;
omnia's snapshot codec already tags bigint and byte arrays.

### 2.2 Why not a fresh generic package

A new unrelated base interface would deepen fragmentation, and a fresh
save()-per-store model would lose the shared transaction boundaries the commerce
store already has. Pre-release means we can dissolve the duplicates instead of
bridging them.

### 2.3 Non-goals

- **No new reservation/nonce/execution-accounting system.** agent-policy already has it.
- **No model, message-bus, or cache framework.** This RFC is about durable state.
- **No storage-crypto change hidden inside a layout fix.** Making the WOTS journal
  append-only is a *physical* change; switching its hash chain to `sha3_256` is a
  *cryptographic/format* change that ships only in its own versioned proposal
  (OQ3 resolved: deferred, §7). Physical and cryptographic changes are never
  bundled.
- **No forced migration of state-critical formats with live commitments.** Format
  changes go through per-surface gates, and **valuable state is never silently
  wiped.** Pre-release does not mean disposable: **signing history,
  funded-channel state, unilateral recovery material (statechain `reclaimTx`,
  watermarks), and user evidence are valuable state**, distinguished from
  disposable fixtures (scratch caches, dev registries, mining attempts). Every
  store that can hold valuable state detects the on-disk format version and
  either migrates it via a declared, tested path or **refuses to open**
  unsupported state — never silently reinitialising (see §4.2 *state versioning*).
- **KISSVM `STATE`/`PREVSTATE` are excluded** — execution/chain semantics, not storage.
- **Governance membership snapshots are domain artifacts**, not database snapshots.
- **Proof/raster/spatial primitives stay independent** of the storage layer.
- **A Hyperbee backend ≠ a configured replication policy.** We reuse BareKVStore; we
  do not claim replication guarantees.

## 3. Current State (verified)

All paths below are verified against the current checkout; the three headline
claims from the audit are confirmed at the source level.

### 3.1 Existing transactional backends

- **Commerce** — `packages/edge-adapters/src/sqlite-commerce-store.ts`
  `SQLiteCommerceStore implements CommerceStore`, with five contracts:
  `NegotiationStore`, `PurchaseStore`, `ReplayLedger`, `PrincipalNegotiationStore`,
  `OutboxStore` (interfaces in `packages/edge/src/purchasing/{store,messages,outbox}.ts`).
  Revision CAS (`UPDATE … WHERE id = ? AND revision = ?`, result `changes === 1`)
  and `transitionAndEnqueue` (one `BEGIN/COMMIT` around CAS + outbox inserts) are
  confirmed. Conformance suite:
  `packages/edge-adapters/src/__tests__/commerce-store.conformance.test.ts`, which
  runs both `InMemory` and SQLite `:memory:` backends. SQLite driver:
  `better-sqlite3` (the `node:sqlite` module is only a Jest mock).

- **Run state** — `packages/agent-policy/src/sqlite-run-state-store.ts`
  `SqliteRunStateStore implements RunStateStore, GrantUsageStore` over
  `autonomy_runs`, `autonomy_reservations`, `autonomy_nonces`,
  `autonomy_mandate_usage`. Covers run/step reservations, committed/aborted steps +
  receipts, operation nonces (`INSERT OR IGNORE`), mandate usage, reservation expiry
  (TTL check on `expires_at`), budget/concurrency accounting (`countCommitted`/
  `countReserved`/`countAborted`, run totals). A file-backed reopen test exists
  (`packages/agent-policy/src/__tests__/sqlite-run-state-store.test.ts`), and the
  SQLite suite skips when native `better-sqlite3` bindings are unavailable.

### 3.2 Existing generic interfaces

- `core.StorageAdapter` (`packages/core/src/adapters/index.ts`):
  `get<T>(key): Promise<T|null>`, `set<T>(key, value)`, `remove(key):
  Promise<boolean>`, `clear()`, `keys()`, `has(key)`. Implemented/consumed by
  `LeaseStore`, `WatermarkStore`, `TransactionReceiptStore` (core), `PortfolioCache`
  (realtime), and a `localStorage`-backed adapter (PWA wallet).
- `tx-builder.KeyValueStorage` (`packages/tx-builder/src/adapters.ts`): a smaller
  `get/set/remove` (no `clear`/`keys`/`has`; `remove` returns `void`), used by
  `CoinSelectionService` and `MultisigManager`. No concrete impl ships in the package.

**Dependency direction (constraint).** Hashing — `sha3_256`, `hashCanonical`,
`canonicalJson`, `toHex` — lives in `@totemsdk/core` (exported from
`packages/core/src/index.ts`), backed by `@totemsdk/core-wasm`. It is transaction
critical and **stays in core**; core must **never** import a storage package.

### 3.3 Verified gaps (source-confirmed)

| # | Gap | Location |
|---|-----|----------|
| G1 | Corrupt JSON → `null` / empty-on-failure / swallowed flush | `packages/server/src/adapters/storage.ts`, `packages/omnia-host/src/signing.ts`, `packages/pear/src/storage/BareFileStore.ts` |
| G2 | `clear()`/`keys()` not prefix-scoped; bare `JSON.stringify` (bigint throws) | `packages/server/src/adapters/storage.ts` |
| G3 | WOTS journal appends whole array, O(n²), SHA-256 chain | `packages/wots-lease/src/journal.ts` |
| G4 | MQTT: in-memory queue, dequeue-then-publish crash window, process-local replay Set | `packages/edge-mqtt/src/queue.ts`, `packages/edge-mqtt/src/command-handler.ts` |
| G5 | Purchase-payment cache is not an atomic claim | `packages/edge-adapters/src/purchase-payment.ts` |
| G6 | Memory-only domain registries (bonds), `ActionStorage` that is interface-only, VTXO/pool snapshot ports with in-memory impls | `packages/provider-bond`, `packages/liquidity-bond`, `packages/industrial-action`, `packages/omnia-pool`, `packages/omnia-vtxo` |
| G7 | Conformance suites run `:memory:` — no disk-survival gate, and native-SQLite suites may *skip* when bindings are absent | `packages/edge-adapters/src/__tests__/commerce-store.conformance.test.ts`, agent-policy SQLite suite |
| G8 | `ProofGraphStoragePort` (`save`/`load`/`findByNodeId`) is **interface-only** — no adapter exists anywhere in the workspace, so proof/evidence graphs default to lost on restart; proof/location/spatial/raster/integritas packages persist nothing of their own | `packages/proofgraph/src/types.ts:97-101` |
| G9 | Factory signing state (pending commitment, `pendingSignatures`, `stateLog`) is memory-only; router/splice fulfilments and committed reservations live in process-local `Set`s | `packages/omnia-factory/src/types.ts:84-128`, `packages/omnia-router/src/*`, `packages/omnia-splice/src/*` |
| G10 | tx-builder multisig/coin-selection state is caller-injected `KeyValueStorage` with **no shipped concrete implementation** | `packages/tx-builder/src/adapters.ts:1-5` |

### 3.4 Surfaces we retain, not reimplement

Lookup node (SQLite dedup/cache/KV/watchlists/registries), omnia-host (SQLite
channel store + operation journal), analytics (DuckDB stays separate from the
settlement path), statechain (`@totemsdk/se-server` PostgreSQL: ownership,
revocations, atomic nonce consumption, encrypted reclaim fields), recursive-MAST
policy-store (content-addressed executable material + availability audit), omnia
omnia-pool/VTXO ports, governance/authority (in-memory, stateless), root identity
(in-memory watermarks with export/restore), wallet apps (Chrome/IndexedDB vaults,
permissions, leases).

### 3.5 Intelligence & QVAC persistence boundaries (audit baseline addition)

`@totemsdk/intelligence` (contracts) and `@totemsdk/qvac` (adapter) add a new
persistence axis: most state that *looks* durable is **provider-owned** inside the
injected `@qvac/sdk` runtime. The QVAC adapter holds no database of its own — RAG
documents, embeddings, workspaces, model downloads and caches, and registry state
live in the QVAC runtime's storage and are reachable only through its operation
surface (`ragChunk`, `ragIngest`, `ragSaveEmbeddings`, `ragSearch`,
`ragListWorkspaces`, `ragCloseWorkspace`, `ragDeleteWorkspace`,
`ragDeleteEmbeddings`, `ragReindex`, `loadModel`, `unloadModel`, `deleteCache`,
`downloadAsset`, `suspend`/`resume`/`state`). This forces the storage contract to
separate persistence by **owner and rebuildability**, not by surface name:

| Class | Examples | Owner / persistence | Storage contract treatment |
|-------|----------|---------------------|----------------------------|
| **Totem-owned durable state** | Inference execution/usage records, budget/mandate consumption (agent-policy `GrantUsageStore`, `autonomy_mandate_usage`), content-access entitlements | Totem components | `strict` reliability; usage journal with accounting recovery; restart never implies inference resumption |
| **Provider-owned persistence** | RAG docs + chunks, embeddings, workspaces, model downloads + caches, registry state | QVAC runtime (**provider-internal** — Totem does not assert its on-disk layout) | Reached only via `rag*` / `models` ops; deletion via `ragDeleteWorkspace` / `ragDeleteEmbeddings` / `deleteCache` / `unloadModel`; never reimplemented; **backend internals/crash behavior require provider verification (see note below)** |
| **Rebuildable caches** | Model caches, embeddings, API snapshots | Provider-owned; derivable from source documents/models | Rebuild path (`ragReindex`, re-download) documented and treated as a cache (lenient) |
| **Ephemeral runtime resources** | In-flight inference runs, token/event streams, sessions | Process | Recreated on restart; provider restart must **not** imply inference resumption or re-run |
| **Reservations (budget/payment/signing, etc.)** | `autonomy_reservations`, WOTS key reservations, pending orders/funding commitments | Totem-owned, **never ephemeral** | Must survive restart, or a conservative reconciliation must exactly restore them. Losing a reservation must **never** restore spending capacity or re-expose a reserved WOTS key index to reuse |
| **Signed vs advisory receipts** | `IntelligenceResult.receipt`, `IntelligenceReceipt` | v1 receipts are **unsigned advisories** produced by the adapter (`@totemsdk/intelligence` types) | Persisted usage is never represented as a verified/WOTS receipt; signing is a wallet-layer concern |

**Deletion & revocation.** `ragDeleteWorkspace` vs `ragDeleteEmbeddings` vs
`ragReindex` give Totem lifecycle knobs for content revocation, but **revocation
is not deletion**: revoking one principal's entitlements denies access without
touching a shared workspace or other principals' embeddings, and no destructive
cleanup follows automatically. The storage layer defines **two separable
contracts**: *revocation* (deny entitlements → gate any further retrieval/
context — enforced once the authoritative revocation is observed, with a declared
freshness/offline policy per enforcing surface, §5) and a *separate deletion/retention
decision* (invalidate chunk/embedding
records → drop caches → purge retained outputs → tombstone workspace/index).
Destructive cleanup runs **only** when that deletion/retention decision fires,
and executes **through provider ops**, never by writing into provider storage.
Totem does **not** assert provider-side retention behavior (see the
verification-level rule in §5).

**Provider ops ≠ provider storage guarantees.** Issuing a `rag*`/`models` op and
receiving `ok` proves the op was accepted, not how the QVAC runtime behaves on
disk, after a crash, or during a reindex. Any gate that depends on provider
*crash semantics* (e.g. "an orphan chunk is marked stale by reindex", "model
downloads are atomic") is a **provider-verification gate**, not an SDK
guarantee — exercised against the injected runtime (Phase 3a), never assumed.

## 3.6 Package persistence matrix (checked against `SDK_MANIFEST.json`, 60 packages)

Each published package gets exactly one disposition; per-surface rows record the
durable owner, the guarantee actually made, and the acceptance gate. Notes in the
phase plan (§6) reference the row labels (G6–G10, phases).

- **Migrate** — surface exists but violates the contract; move it onto shared
  primitives (`FileStore`/`SqliteStore`/`Journal`/codec) in the listed phase.
- **Retain** — surface already satisfies the contract; we *record* its contract,
  lifecycle owner, and verification gate, and do not reimplement it.
- **Delegate** — durability is intentionally owned by a caller, injectable port,
  provider runtime, or external system; the package itself ships no durable store
  and documents its owner (e.g. the wallet/caller durably owns unilateral recovery
  material such as the statechain `reclaimTx`).
- **Ephemeral** — genuinely stateless or fully derivable; no durability required,
  rebuild path documented.
- **Defer+consequence** — durable need exists but is deferred; the consequence of
  loss and the gate required before production use are recorded *now*.

| Package (domain) | Durable surface(s) | Disp. | Owner | Guarantee | Acceptance gate |
|---|---|---|---|---|---|
| **cryptographic-foundation** | | | | | |
| @totemsdk/core | `StorageAdapter` base type; hashing (`sha3_256`, `hashCanonical`, `canonicalJson`, `toHex`); **persistence consumers:** `LeaseStore`, `WatermarkStore`, `TransactionReceiptStore` (all write via `StorageAdapter`) | **Retain** | core | Base interface canonical; hashing stays in core, `storage → core` one-way; **consumer recovery guarantees are established by conformance, not implied by an unchanged interface** | Import-lint (Phase 0); core-consumer reopen/corruption/transaction-lifecycle tests (Phase 4) |
| @totemsdk/core-wasm | — | **Ephemeral** | — | Stateless compiled engine | — |
| @totemsdk/kissvm | — | **Ephemeral** | — | Deterministic evaluator | — |
| @totemsdk/recursive-mast | Policy-store (content-addressed executable material + availability audit) | **Retain** | recursive-mast / caller | Content-addressed integrity; availability audit retained | Cycle-guard integration (Phase 5); recovery path independent of content gate |
| @totemsdk/txpow | — (mining attempts) | **Ephemeral** | — | Serialization/PoW deterministic | — |
| @totemsdk/wots-lease | Watermarks, lease reservations, `LeaseJournal` | **Migrate** | wots-lease | Journal **physically append-only** (SHA-256 chain unchanged); watermark/lease durable via `StorageAdapter`; reservation survival (never re-expose a reserved key index) | Reopen + corruption + power-loss; reservation-loss test (Phase 3) |
| **sovereignty-stack** | | | | | |
| @totemsdk/lookup-node | SQLite dedup/cache/KV/watchlists/registries | **Retain** | lookup-node | SQLite durability; dedup/cache rebuildeable | Reopen + corruption scripts (Phase 4 sweep) |
| @totemsdk/lookup-client | — | **Delegate** | lookup-node / server | Client state ephemeral; durable data owned by node | — |
| @totemsdk/lookup-protocol | — | **Ephemeral** | — | Wire format | — |
| @totemsdk/chain-provider | — | **Ephemeral** | — | Stateless strategy interface | — |
| @totemsdk/minima-rpc | — | **Ephemeral** | — | Stateless RPC client | — |
| @totemsdk/realtime | Portfolio cache (via injected `StorageAdapter`) | **Delegate** | caller-injected adapter | Cache rebuildeable from chain; live WebSocket state ephemeral | Reconnect/rebuild test (Phase 6) |
| @totemsdk/mcp-server | — | **Ephemeral** | — | Metadata/tooling service; reads `SDK_MANIFEST` | Manifest sync gate |
| **payment-network** | | | | | |
| @totemsdk/omnia | Channel state machine | **Delegate** | omnia-host / caller | State-machine logic deterministic; channel state persisted by host | omnia-host reopen/audit (Phase 4) |
| @totemsdk/omnia-factory | Factory signing state: `pendingCommitment`, `pendingSignatures`, `stateLog` | **Migrate** | omnia-factory (via host) | **Recovery ownership (G9):** pending commitments, partial-signature counts, and log survive restart; no partial-funding loss | Factory crash-window test (kill mid-signing-round); recovery gate (Phase 3) |
| @totemsdk/omnia-router | In-progress route segments; fulfilled-op sets | **Migrate** | omnia-router (via host) | **Multi-channel partial-op recovery (G9):** settled-segment records/preimages survive restart | Router restart-mid-route test (Phase 3) |
| @totemsdk/omnia-splice | In-progress splice state across participants | **Migrate** | omnia-splice (via host) | **Multi-channel partial-op recovery (G9):** partial splice commits recoverable/reconcilable | Splice crash-window test (Phase 3) |
| @totemsdk/omnia-vtxo | VTXO/pool snapshot ports | **Migrate** | omnia-vtxo / omnia-pool | Pool/VTXO state durable via shared store (G6) | Snapshot reopen test (Phase 3) |
| @totemsdk/statechain | Client-side chain state incl. the current owner's **pre-signed `reclaimTx`** (unilateral recovery material) | **Delegate** | **wallet / caller** (durable) + se-server (coordination) | Wallet/caller durably owns unilateral recovery material; recovery without SE cooperation must **not** depend solely on SE storage | Client-side recover-cost test without SE; statechain reopen + corruption test (Phase 4) |
| @totemsdk/se-server | PostgreSQL: ownership, revocations, atomic nonce consumption, encrypted reclaim fields | **Retain** | se-server | Relational ACID; encrypted reclaim at rest | Relational contract documented + conformance (Phase 4) |
| @totemsdk/tx-builder | Multisig config, pending tx, coin-selection | **Migrate** | tx-builder / caller | `KeyValueStorage` dissolved onto `StorageAdapter` (G10); **durable:** multisig config + pending tx (with format detection & safe migration, §4.2); **ephemeral:** coin-selection scratch | Migration + classification tests (Phase 3) |
| @totemsdk/omnia-host | SQLite channel store + operation journal; `JsonFileStorageAdapter` glue | **Retain** | omnia-host | Channel store/journal retained; glue hardened via shared `FileStore` | Reopen + corruption + power-loss scripts (Phase 4) |
| @totemsdk/omnia-pool | Pool orchestration state | **Migrate** | omnia-pool | Snapshot/accounting durable (shared with omnia-vtxo, G6) | Snapshot reopen test (Phase 3) |
| **edge-computing** | | | | | |
| @totemsdk/edge | — (composed runtime) | **Delegate** | injected ports | No owned durable state; delegation explicit | Port-driven conformance |
| @totemsdk/edge-adapters | Commerce SQLite store; Node/InMemory/Pear adapters; purchase-payment | **Migrate** | edge-adapters | CAS + outbox on shared `SqliteStore`; **atomic purchase claim** (G5); adapter hardening | Conformance on InMemory/`:memory:`/durable-file SQLite; idempotency concurrency test (Phases 1–3) |
| @totemsdk/edge-mqtt | Offline queue, replay ledger, dedupe/ack | **Migrate** | edge-mqtt | **Only edge surface with SDK-owned queue (G4):** claim/ack/retry + persisted replay; crash between claim & publish re-delivers, never loses | MQTT crash-window test; reopen; dead-letter exercised (Phase 3) |
| @totemsdk/edge-bacnet, edge-ble, edge-can, edge-coap, edge-grpc, edge-lorawan, edge-matter, edge-modbus, edge-opcua, edge-ros2, edge-email | Gateway connections; command ingestion | **Delegate** | caller / remote system | No SDK-owned offline queue — **MQTT coverage is not presumed** elsewhere; downtime commands are lost unless the caller journals them | Declared owner per transport; caller-journal gate above these packages |
| @totemsdk/pubsub-transport | — | **Ephemeral** | — | Interface definitions | — |
| @totemsdk/stream-transport | — | **Ephemeral** | — | Transport adapters | — |
| @totemsdk/pear | `BareKVStore` (Hyperbee); `BareFileStore` | **Retain** | pear | KVStore retained as supplied (errors propagate); **replication policy not claimed** | `BareFileStore` semantics hardened via shared `FileStore` (Phase 2); KV reopen test |
| @totemsdk/server | `FileStorageAdapter` | **Migrate** | server | Corrupt ≠ absent; prefix-scoped `clear`/`keys`; bigint/bytes codec (G1/G2) | G1/G2 tests on hardened `FileStore` (Phase 2) |
| @totemsdk/wallet-adapter | Vaults, permissions, leases | **Delegate** | concrete wallet impl | Abstract base; vault/permission/lease ownership is the wallet's, per-wallet policy | Per-wallet conformance (Phase 6) |
| @totemsdk/connect | Wallet discovery; provider connections; **reconnectable app state** | **Delegate + Defer+consequence** | browser extension / app | Live connections + discovery caches ephemeral; reconnectable state owned by extension (`extensions/totem-*`) | **Defer+consequence:** SDK does not persist app state; consequence = re-connect/re-auth on reload; gate = extension migration (Phase 6) |
| @totemsdk/industrial-action | `ActionStorage` (interface-only) | **Migrate** | industrial-action | Durable action-lifecycle records (G6) | `ActionStorage` reopen test (Phase 3) |
| **verifiable-claims** | | | | | |
| @totemsdk/proof, proof-integritas | — (envelopes; anchors on-chain) | **Ephemeral** | — | Deterministic verification; no local durable store | — |
| @totemsdk/proofgraph | `ProofGraphStoragePort` (`save`/`load`/`findByNodeId`), graph + index | **Migrate** | proofgraph | **Evidence-graph durability (G8):** consistent graph/index updates, restart recovery, concurrent-update safety; durable owner for evidence from proof/location/spatial/raster/integritas — the drone-flight provenance chain; evidence *bytes* persist via the minimal artifact adapter (§4.3) | Shared durable adapter + concurrency + reopen tests (Phase 3); evidence-chain test raster→spatial→location→integritas **over a concrete artifact adapter or named external store with a tested contract** — graph references alone do not satisfy the gate (Phase 3) |
| @totemsdk/identity, manifest | — | **Retain** | identity / manifest | Signed formats; verification = signature check; persistence up to caller | Signature verification gates; contract recorded |
| @totemsdk/root-identity | In-memory watermarks w/ export/restore | **Retain** | root-identity | Watermark durability via `StorageAdapter`; export/restore retained | Watermark reopen + corruption test (Phase 4) |
| @totemsdk/governance | Engine + snapshots | **Retain** | governance | Engine deterministic, in-memory; membership snapshots are signed **domain artifacts**, not DB snapshots | Snapshot verifiability gate (Phase 4 sweep) |
| @totemsdk/authority | — | **Ephemeral** | — | Deterministic evaluator | — |
| @totemsdk/agent-policy | `SqliteRunStateStore` / `GrantUsageStore` (`autonomy_*` reservations, nonces, mandate usage) | **Migrate** | agent-policy | Reservations survive restart or reconcile conservatively; run/step/nonce/budget accounting durable; **domain accounting authority** for agent-policy budget/mandate consumption (the journal is its audit trail, never a rival counter) | Reopen + crash + reservation-survival; accounting-reconciliation test journal ↔ `GrantUsageStore` (Phases 1, 3a) |
| @totemsdk/provider-bond, liquidity-bond | Bond records, claims | **Migrate** | bonds | Durable bond/claim registry (G6) | Reopen test (Phase 3) |
| @totemsdk/location-proof, spatial-proof, raster-proof | — (claims, geometry, manifests) | **Ephemeral** | proofgraph (evidence home) | Primitives deterministic; durable evidence lands in the ProofGraph evidence chain, not here | Evidence-chain integration test (Phase 3) |
| **intelligence** | | | | | |
| @totemsdk/intelligence | — | **Ephemeral** | — | Contracts/types; no durable state; v1 receipts are unsigned *advisories* | — |
| @totemsdk/qvac | Provider-owned RAG/workspace/model storage | **Delegate** | QVAC runtime | Provider persistence reached only via ops; Totem-owned usage/accounting journal lives in `@totemsdk/storage`; **provider crash/disk behavior requires provider verification** | Provider-verification gate (Phase 3a); Totem-owned journal tests are SDK guarantees |

Disposition counts (per package, 60 total): 15 **Migrate**, 10 **Retain**, 18
**Delegate**, 16 **Ephemeral**, 1 combined **Delegate+Defer+consequence**
(`connect`) — `connect` is counted once, in the combined bucket, not again in
Delegate; grouped gateway rows share the delegate disposition and the labelled
`edge-*` transports are counted individually.

## 4. Architecture

### 4.1 Dependency graph (acyclic, enforced)

```
   ┌─── @totemsdk/core ──── @totemsdk/core-wasm   (transaction-critical hashing)
   │                          ▲
   │                          │ sha3_256 | hashCanonical | canonicalJson | toHex
   │                          │ + canonical base StorageAdapter type (re-export)
   │                          │
   └── @totemsdk/storage ─────┘
          ▲          ▲            ▲
   apps / adapters / intelligence   (edge-adapters, agent-policy, server,
                                     edge-mqtt, wots-lease, omnia-host, pear,
                                     realtime, tx-builder, bonds, …)
```

- `storage → core` only. `core` imports **nothing** from storage. No cycle, by
  construction. A CI import lint forbids `packages/core/src/**` from importing a
  storage path and `packages/storage/src/**` from importing `@totemsdk/core`
  transitively in a cycle.
- The **base storage interface stays in `@totemsdk/core`** (`StorageAdapter`), the
  canonical `get/set/remove/clear/keys/has`. `@totemsdk/storage` re-exports and
  extends it; it does not shadow it.
- `tx-builder.KeyValueStorage` is **dissolved**: `CoinSelectionService` and
  `MultisigManager` type against `StorageAdapter` (or a structural
  `Pick<StorageAdapter, 'get'|'set'|'remove'>`).

### 4.2 `@totemsdk/storage` deliverables

The package stays **provider-neutral** — it knows nothing about QVAC, RAG
workspaces, or inference. QVAC-specific workspace/index semantics live in
`@totemsdk/qvac`'s integration layer and are enforced through provider ops.

| Contract | Description |
|----------|-------------|
| `StorageError` taxonomy | `not-found | corrupt | unavailable | write-failed`, all surfaces distinguish absent vs broken vs down |
| `Codec` | One **versioned** `serialize`/`deserialize` with bigint + `Uint8Array` tags (promoted from omnia's `__omniaBigInt`/`__omniaBytes`); no more bare `JSON.stringify` on bigint. The storage encoding is **distinct from signed canonicalization** (`canonicalJson`/`hashCanonical`): committed bytes/hashes are never silently re-encoded; encoding changes ship with an explicit version |
| `Namespace` | Prefix-scoped `keys()` and `clear()`; shared directories are safe by construction (fixes G2) |
| `Transaction` + CAS | Generalized `transitionAndEnqueue`: revision-CAS update + outbox-style enqueue in one commit, reusable across stores on one connection |
| Write acknowledgment | Per store, one of **`volatile`** (ack before any disk state), **`buffered`** (ack before durability — bounded loss window on crash), or **`durably-acknowledged`** (the write path itself commits/fsyncs *before* returning success). Only `volatile`/`buffered` stores may still hold pending durability when `close()` is called. Declared per store, independently of the failure policy below |
| Failure policy (`strict` / `lenient`) | **Error handling, separate from the durability modes.** `strict`: corruption/unavailability is an error, never treated as absent (signing history, accounts, evidence graphs, recovery material); `lenient`: absence tolerated (caches). The contract also fixes concurrency/CAS (`update … WHERE revision`), transaction scope, and `flush()`/`close()` semantics: `flush()`/`close()` drain and **report failures** for `buffered` writes; a `durably-acknowledged` store has no pending durability by construction (success implies commit) |
| `Journal` + versioned records | Append-only, restart-recoverable record journal with versioned/forward-migratable records — the home for inference usage/execution *audit* records, MQTT replay, WOTS watermarks, and identity chains. **Single accounting authority, per domain:** the journal records, the owning domain interface accounts (see *Accounting authority* below); it never competes as a second counter (resolves OQ8) |
| `Blob`/artifact storage | **Boundary + minimal adapter + pluggable backend port now, sophisticated backend deferred (resolves OQ7):** ownership, stable references, integrity, retention, recovery are specified in §4.3; a minimal durable `ArtifactStore` (byte put/get, digest-verified on read, `not-found` vs `corrupt`) ships in-package over a pluggable **`ArtifactStoreBackend`** port, so any external store (Arweave/Filecoin/IPFS/torrents/Drive/object stores) is adapted by config, never an endless integration list. Only chunking/CAS/GC/streaming is deferred until a consumer needs it. Streamed artifacts (`textToSpeechStream`, `audioGen`, `video`, diffusion outputs) are retyped/resumed by consumers now |
| Conformance harness | Runs the same suite over `InMemory`, `:memory:` SQLite, **and** a durable file-backed SQLite (disk-survival gate). Reopen tests do **not** prove crash/power-loss survival. A **required durability job** in CI must **FAIL** if a backend a deployed gate depends on cannot run; native-binding skip is allowed only for optional runs |
| Runtime portability | Native `better-sqlite3` and Node `fs` sit behind **isolated subpaths**; runtime-specific file implementations (Bare/Pear) never leak into the neutral core — bare vs node are build-runtime concerns, not storage contracts |
| Accounting authority | Authority lives in the **existing domain contracts** and their respective accounting responsibilities: `GrantUsageStore` (agent-policy budget/mandate consumption), commerce replay/outbox (purchase accounting), `WatermarkStore` (key-use watermarks), and so on per surface. The journal is an append-only audit trail reconciled to each domain authority and never competes as a second counter; the reconciliation boundary is stated per domain in the store contract |
| State versioning & migration | On-disk records carry an explicit format version. Opening a store holding **valuable state** with an unsupported or ambiguous version **refuses to open** (or migrates via a declared, tested path) rather than silently reinitialising — signing history, funded-channel state, unilateral recovery material, and user evidence are never wiped by a format change (§2.3) |

Shared backends in the package:

- `SqliteStore` (better-sqlite3) — transaction/CAS primitives + `transitionAndEnqueue`.
- `FileStore` (hardened file/JSON; correct `corrupt`/`write-failed` via a journal or
  temp+rename) — replaces `server.FileStorageAdapter`, omnia
  `JsonFileStorageAdapter`, Pear `BareFileStore`.
- `MemoryStore` (in-memory; conformance-only and dev).
- `LocalFsBackend` (reference `ArtifactStoreBackend` adapter — proves the seam;
  no provider registry is maintained).
- Pear `BareKVStore` (Hyperbee) is **retained as supplied** — its `get()` propagates
  errors; only `BareFileStore` semantics are replaced.

**No silent downgrade.** A consumer that requires `durably-acknowledged`, atomic,
or conditional (CAS) writes must verify the adapter's declared capabilities and
**reject** an adapter that cannot provide them at construction time — it must
never silently degrade to `volatile` or to un-conditional access. This rule
applies to every delegation in the matrix (§3.6): an injected adapter's declared
modes are contractual, and a consumer may not bypass them.

### 4.3 Artifact-storage boundary (minimal adapter now, backend deferred)

Streamed/diffusion/audio/video/raster artifacts get a boundary contract now so
durable output retention is a slot, not an afterthought:

- **Ownership.** The artifact owner is declared at creation (provenance chain or
  consumer); the journal records references, not bytes.
- **Stable references.** Content-addressed references (hash) + namespace; identity
  is independent of layout.
- **Integrity.** Stored bytes hash to the committed digest at write time;
  read-side verification is optional-cheap, and **strict** when the artifact is
  evidence-bearing (ProofGraph evidence chain, §3.6).
- **Retention.** Declared TTL + retention policy (per-principal, §3.5; cleanup
  fires only under the separate deletion/retention decision); policy mirrored to
  the journal.
- **Recovery.** Retrieval distinguishes **`not-found`** (bytes absent) from
  **`corrupt`** (bytes present but failing integrity) — corruption is never
  collapsed into absence. Recovery provenance (re-derivable from source, or
  tombstoned) is additional metadata on that result, not a replacement for the
  distinction; `corrupt` surfaces under `strict` when the artifact is
  evidence-bearing — never fail-open.
- **Backend port.** `ArtifactStoreBackend` is an explicit, artifact-shaped adapter
  seam — a **content-addressed byte-mover, deliberately not a KV store** — so it
  can never shadow the transactional `StorageAdapter` contract. It declares its
  capabilities (`writable`, `acknowledge: volatile | buffered |
  durably-acknowledged`, `atomic`, `retention: fixed | managed | none`,
  `offlineReadable`) and exposes `put` / `get` (returning
  `ok | not-found | corrupt | unavailable`) / optional `delete`. `ArtifactStore`
  wraps a minimal local store around the pluggable backend; all mutation/GC/
  tombstone/retention logic stays local, remote stores just move and verify
  bytes. A **backend conformance suite** (`backend.conformance.test.ts`:
  fetch+verify, status taxonomy, delete/retention where declared) is what "tested
  contract" means — an external store earns that label only by passing it. One
  reference adapter (local file system) ships to prove the seam; the SDK never
  maintains a provider registry. Chunking/CAS/GC later slot in behind this port.

The **minimal durable `ArtifactStore`** (byte put/get with committed-digest
verification on read, `not-found` vs `corrupt` distinction) ships in
`@totemsdk/storage` as a wrapper over the pluggable `ArtifactStoreBackend` port;
the advanced blob backend (chunking, CAS, GC, streaming) is **deferred until a
consumer requires durable retention** (OQ7 resolved). The ProofGraph
flight-evidence gate (Phase 3) refuses to pass on graph references alone —
evidence bytes must restore through the `ArtifactStore` or a named external store
with a **tested contract** (one that passes the backend conformance suite).

## 5. Security & Sovereignty

- **Hashing is untouched.** `sha3_256`/`hashCanonical` stay in core, underwriting
  WOTS/tx commitments. **Physical and cryptographic journal changes are separate
  (resolved OQ3):** making the WOTS journal append-only is an explicit, gated
  *layout* change (G3); switching its chain to `sha3_256` is deferred to its own
  versioned/crypto proposal because it changes on-disk commitments — and stays
  distinct from the storage codec (§4.2), which never re-encodes committed bytes.
- **Signing history must not fail open.** Any store holding signing history,
  lease/watermark journals, or channel state runs in `strict` mode: corruption is
  surfaced, never treated as absent. Caches may run `lenient`.
- **MQTT** moves to claim/ack/retry: a message is only forgotten after a durable
  ack; replay ledger is persisted. A crash between claim and publish re-delivers
  rather than loses.
- **Payment exactly-once is honest.** The purchase-payment adapter gains an atomic
  claim (pending marker) before the external port call; we document that final
  exactly-once still depends on the payment system's own reconciliation.
- **Gated content cycle guard.** Recursive-MAST policy availability must not gate
  the policy needed to *authorize or recover* an operation; critical recovery
  material gets an explicit availability policy, separate from content
  authorization (RFC-006-style capability strings do not gate recovery).
- **Intelligence content access is not the `intelligence:rag` capability.**
  Permitting the `rag` *domain* is not sufficient authorization to read every
  document in a workspace. Content-level access must be enforced **before**
  protected material reaches retrieval results or model context: entitlements are
  checked below the dispatch gate and above the provider call, and the provider
  never receives retrieval parameters for content the principal may not read.
  Purchase entitlements and authority checks stay **above the backend** and reuse
  existing accounting (`agent-policy` mandates/budgets) rather than introducing a
  second accounting layer. Revocation and deletion are separate decisions (§3.5):
  revocation denies an entitlement and gates retrieval/context **once the
  authoritative revocation is observed** — enforcement is not instantaneous
  propagation across disconnected devices, so each enforcing surface declares its
  **freshness/offline policy** (how stale a cache may be before denial, and what
  happens while offline);
  `ragDeleteEmbeddings`/`ragDeleteWorkspace`/cache purge fire **only** under a
  distinct deletion/retention decision, while retained outputs are handled
  per-process. Totem does **not** assert that provider-retained outputs are never
  exposed past a revocation window: access denial to one principal is independent
  of cleanup, and revoking one principal never requires deleting the workspace or
  other principals' embeddings (revocation ≠ deletion, §3.5).
- **Verification levels, not receipt claims.** Persisted inference usage is audited
  data, **not** a verified receipt; claims carry an explicit level:
  **provider-reported** (v1 `IntelligenceReceipt` — unsigned advisories from
  `@totemsdk/intelligence`), **authenticated/attested** (WOTS-signed receipts, a
  wallet-layer follow-up), and **policy-accounted** (journal ↔ owning domain accounting authority, e.g.
  `GrantUsageStore` — the SDK guarantee). Issuing a receipt *contract* is separate
  from producing one: an optional receipt contract does not raise the default
  level. A provider restart does **not** resume an interrupted inference run, and
  an interrupted run's journal entry is recovered as *interrupted*, never
  replayed or receipted.
- **Encrypted/sensitive records stay at their layer.** Statechain PostgreSQL
  encrypted reclaim fields, wallet vault encryption, permissions, and schema
  versions are not re-homed; their contracts are documented, not copied.

## 6. Phased Plan

All stages land **without back-compat** (pre-release). Repo gate invariant:
`verify-workspace.mjs` (`--typecheck`, `--lint`, `--test`) stays green per landing,
and `SDK_MANIFEST` sync (`scripts/verify-sdk-manifest.mjs`) is updated when the new
package is added (maturity `alpha`: typecheck/lint/test). Every matrix acceptance
gate (§3.6) is exercised in the phase named in its row; a gate with no phase
(delegation rows) is covered by the delegation conformance in Phase 1.
**Deferred gates are the exception:** a gate on a Phase 6 / Defer+consequence
row is **not exercised in this RFC** — its consequence is recorded and it is
re-opened only when that scope is respecified; it is not simultaneously promised
and deferred.

| Phase | Scope | Acceptance gate |
|-------|-------|-----------------|
| **0** | `@totemsdk/storage` scaffold: `StorageError`, codec, `Namespace`, `Transaction`/CAS, artifact-boundary types + **`ArtifactStoreBackend` port** (§4.3), `FileStore`/`MemoryStore`/`SqliteStore`, core-substrate conformance harness, backend conformance suite + **one reference backend adapter** (local-fs), CI import-lint for the `storage→core` DAG | New conformance suite green on `InMemory`, `:memory:`, and durable file-backed SQLite; backend conformance green on the reference adapter (fetch+verify, `not-found`/`corrupt`/`unavailable`, delete/retention where declared); **required durable-CI job added that FAILS if a deployed-gate backend cannot run** (native-binding skip only for optional runs); import-lint added; manifest updated |
| **1** | Consolidate transactional backends: extract commerce CAS/`transitionAndEnqueue` and run-state primitives onto shared `SqliteStore`; re-home relevant contracts (still used by `edge`, `agent-policy`) | Commerce + run-state conformance suites green via shared primitives; reopen test retained; `autonomy_*`/commerce records unchanged in shape |
| **2** | Harden runtime adapters: swap `server.FileStorageAdapter`, omnia `JsonFileStorageAdapter`, Pear `BareFileStore` to shared `FileStore`; per-store `strict`/`lenient` declared | `corrupt`/`write-failed` surfaced where `strict`; prefix `clear()`/`keys()` tested; bigint/bytes round-trip through codec |
| **3** | Fill durability gaps: WOTS **physical append-only** journal (G3, hash chain unchanged), MQTT claim/ack/retry + persistent replay (G4), purchase-payment atomic claim (G5), durable backends for bonds/`ActionStorage`/VTXO/pool/factory/router/splice (G6/G9/G10), tx-builder `StorageAdapter` dissolution + migration (G10), ProofGraph durable `ProofGraphStoragePort` adapter + evidence chain **over the minimal `ArtifactStore`** (G8) | WOTS **layout** migration/replay gate (chain-format change stays deferred, OQ3); MQTT crash-window test (kill between claim and publish); factory crash-mid-signing-round test; router restart-mid-route + splice crash-window tests; tx-builder migration + classification (format detection & refusal, §4.2); idempotency concurrency test; registry reopen tests; ProofGraph concurrency + reopen + evidence-chain + **evidence-artifact restore** (`not-found` vs `corrupt`) test |
| **3a** | Intelligence accounting + content access: usage/execution journal over `Journal` (§4.2) reconciled to each **domain accounting authority** (`GrantUsageStore` for agent-policy consumption, commerce replay/outbox for purchases), workspace/embedding lifecycle through provider ops, **enforceable** content-level retrieval gating, revocation vs separate deletion decision (§3.5) | **Reservation survival** (budget/signing reservations survive restart or reconcile conservatively; loss never restores spending capacity or re-exposes a reserved key index); **accounting recovery** (journal replays interrupted runs as *interrupted*, never re-runs or receipts them; reconciles to the owning domain authority); **protected-retrieval isolation** (enforced via verified provider filtering or isolated workspaces — `RagSearchParams`' extensible shape is **not** itself proof of enforcement — content never reaches model context unentitled); **revocation-without-cleanup test** (deny one principal; workspace + other principals' embeddings untouched, no cleanup fired); **provider-verification gate** (crash/disk behavior such as orphan-chunk reindexing is exercised against the injected runtime: ✓ = provider-verified, not an SDK guarantee); provider-restart-does-not-resume-inference asserted |
| **4** | Security-critical surfaces: root identity watermark durability; **core `LeaseStore`/`WatermarkStore`/`TransactionReceiptStore` consumer conformance (transaction-lifecycle integration with `StorageAdapter`);** statechain client-side unilateral recovery (`reclaimTx`, wallet/caller ownership) + SE relational contract documented (PostgreSQL stays) | Per-surface acceptance gates: reopen + corruption + power-loss scripts; core-consumer reopen/corruption/transaction-lifecycle tests; statechain recover-without-SE + client-side reopen/corruption tests |
| **5** | Gated content: purchase/authority shared accounting above the backend; recursive-MAST availability integration (cycle guard) | Authority + availability conformance; recovery-path test independent of content gate |
| **6** | Browser/application pass — **recorded deferral, not committed by this RFC:** wallet vault/permissions/**leases**/schema versioning, **reconnectable application state** (explicit owner: the wallet extension, not the SDK), realtime portfolio cache | **Deferral consequence recorded:** wallet/vault/lease/reconnectable-state ownership stays with the extension (§3.6 `wallet-adapter`/`connect`/`realtime`); per-wallet conformance re-opens when browser scope is respecified — no SDK guarantee is claimed before then |

Exclusions from every phase: KISSVM `STATE`/`PREVSTATE`, governance membership
snapshots, proof/raster/spatial primitives, and Hyperbee replication policy.

## 7. Open Questions

1. **Base interface name.** Re-export `core.StorageAdapter` as-is from storage, or
   alias to `Storage` at the storage boundary? (Public surface of both packages is
   ours to shape pre-release.)
2. **SQLite driver standard.** Standardize on `better-sqlite3` everywhere, or adopt
   `node:sqlite` (currently only a Jest mock) as the single engine?
3. **WOTS chain algorithm shift.** **RESOLVED (defer):** the journal moves to a
   physical append-only layout with the SHA-256 chain unchanged (G3); moving the
   chain to `sha3_256`/`hashCanonical` — and exactly which fields keep current
   hashing (branch/device chain continuity) — is its own versioned/crypto
   proposal, never bundled with the layout change (§2.3, §5).
4. **MQTT backend.** Reuse the shared `SqliteStore` for the delivery queue + replay
   ledger, or a dedicated append-only log per topic/command scope?
5. **File durability strategy.** temp-write+rename+fsync per set, or an
   append-only journal + periodic compaction (better for WOTS, MQTT, and file
   stores alike)?
6. **Order of Phases 2–4.** The plan reorders adapters before security-critical
   surfaces; run-state/identity hardening could be pulled earlier if review
   prioritizes it.
7. **Blob/stream storage: include or defer.** **RESOLVED (minimal adapter now,
   advanced later):** streamed artifacts (TTS/audioGen/video/diffusion outputs)
   have no durable owner today. The artifact-storage boundary — ownership, stable
   references, integrity, retention, recovery — is specified now (§4.3), and a
**minimal durable `ArtifactStore`** (byte put/get, digest-verified on read,
    `not-found` vs `corrupt`) ships with `@totemsdk/storage` over the pluggable
    `ArtifactStoreBackend` port (§4.3); only the sophisticated blob backend
    (chunking/CAS/GC/streaming) is deferred until a consumer needs durable
    retention.
8. **Usage journal granularity.** **RESOLVED (authority via domain interfaces):**
   accounting stays with the owning domain contract — `GrantUsageStore` for
   agent-policy budget/mandate consumption, commerce replay/outbox for purchase
   accounting, and so on; the journal is an append-only audit trail reconciled to
   each domain authority, never a competing counter. Granularity (per-invocation
   vs per-run rollups) is decided per-domain in Phase 3a against that rule.
9. **Provider-verification mechanism.** Which concrete script/runtime confirms
   QVAC's documented behaviors (crash semantics, reindex/orphan handling, model
   download atomicity) to earn the `provider-verified` label, and who runs it?
   Default: exercised against the injected runtime in Phase 3a CI until a vendor
   artifact or attestation exists.

## 8. References

- Existing RFCs: `docs/rfc/RFC-001` … `RFC-006` (format, numbering, status).
- Audit baseline: commit `e97b2c1` (`feat(qvac): P8 upstream fidelity…`, current
  `origin/main`, all workspace gates green at audit time).
- Verified sources:
  - `packages/edge-adapters/src/sqlite-commerce-store.ts`, `packages/edge/src/purchasing/{store,messages,outbox}.ts`
  - `packages/agent-policy/src/sqlite-run-state-store.ts`, `packages/agent-policy/src/run-state-store.ts`, `packages/agent-policy/src/grant-usage.ts`
  - `packages/core/src/adapters/index.ts`, `packages/core/src/{lease,tx}/*.ts`, `packages/core/src/{wasm-sync,canonical,index}.ts`
  - `packages/tx-builder/src/adapters.ts`, `packages/tx-builder/src/{coin-selection,multisig-manager}.ts`
  - `packages/server/src/adapters/storage.ts`, `packages/omnia-host/src/signing.ts`, `packages/omnia/src/persistence.ts`
  - `packages/pear/src/storage/{BareFileStore,BareKVStore}.ts`
  - `packages/edge-mqtt/src/{queue,command-handler}.ts`, `packages/edge-adapters/src/purchase-payment.ts`
  - `packages/wots-lease/src/journal.ts`
  - ProofGraph/evidence: `packages/proofgraph/src/types.ts` (`ProofGraphStoragePort`
    — interface only, no concrete implementation), `packages/location-proof`,
    `packages/spatial-proof`, `packages/raster-proof`, `packages/proof-integritas`
  - Factory/router/splice/tx-builder recovery: `packages/omnia-factory/src/types.ts` (`pendingCommitment`, `pendingSignatures`, `stateLog`), `packages/omnia-router/src/*`, `packages/omnia-splice/src/*`, `packages/tx-builder/src/adapters.ts`
  - Package manifest: `SDK_MANIFEST.json` (60 packages, domains, exports)
  - Test suites: `packages/edge-adapters/src/__tests__/commerce-store.conformance.test.ts`, `packages/agent-policy/src/__tests__/sqlite-run-state-store.test.ts`
  - Intelligence/QVAC surfaces: `packages/intelligence/src/{types,index,port}.ts` (unsigned v1 receipts, `usage`/`receipt` on results), `packages/qvac/src/api-snapshot.ts` (RAG + models operation catalog), `packages/qvac/src/vendor/qvac-sdk.d.ts` (provider-owned RAG/workspace/model surface), `scripts/verify-qvac-api-drift.mjs`
  - Prior art: RFC-006 (intelligence domains/capabilities), `docs/rfc/RFC-006-SDK-INTELLIGENCE-QVAC-INTEGRATION.md`