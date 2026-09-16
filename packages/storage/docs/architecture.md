# Storage architecture

`@totemsdk/storage` is the durable-guarantee substrate for the Totem SDK
(RFC-007). This document covers module layout, the write-acknowledgment model,
primitive ownership, and the storage→core dependency rule.

## 1. Module layout

```
packages/storage/src/
  index.ts          neutral surface (never imports native bindings)
  errors.ts         StorageError taxonomy
  codec.ts          versioned value codec (bigint/Uint8Array tags)
  types.ts          capabilities, Transaction/CAS, WriteAckMode, FailurePolicy
  namespace.ts      prefix-scoped Namespace adapter
  transaction.ts    enqueueItem single-commit helper
  adapters/         concrete stores
    sqlite-store.ts   @totemsdk/storage/sqlite   (native better-sqlite3)
    file-store.ts     @totemsdk/storage/fs        (Node fs)
    memory-store.ts   @totemsdk/storage/memory   (ephemeral)
  artifacts/        ArtifactStore + ArtifactStoreBackend port
    backends/local-fs-backend.ts
  conformance/      shared core + backend suites (runCoreConformance/runBackendConformance)
```

Native bindings (better-sqlite3) are reachable only through the isolated `/sqlite`
subpath; the neutral `@totemsdk/storage` entry never imports them. This keeps the
package platform-neutral (Pear/Bare, browsers) while still offering the strongest
durability adapter on Node.

## 2. Write acknowledgment model

Every store declares a `WriteAckMode`:

| Mode | Meaning | Stores |
|------|---------|--------|
| `volatile` | write acknowledged before durable persistence | `MemoryStore` |
| `buffered` | acknowledged after in-memory/buffered persistence | — |
| `durably-acknowledged` | acknowledged only after the write survived a crash (WAL + `synchronous=FULL` / fsync) | `SqliteStore`, `FileStore` |

Durability and failure policy are orthogonal:

- **Durability** answers "will the write survive a power loss?"
- **FailurePolicy** (`strict` \| `lenient`) answers "what do I do on a corrupt
  record during read?" It never masks durability guarantees.

`SqliteStore` sets `journal_mode=WAL` and `synchronous=FULL`, so a write is
acknowledged only once SQLite has committed it to durable storage. `FileStore`
uses atomic file-replace with fsync per write. Consumers requiring the strongest
guarantee assert it at startup (see No-silent-downgrade below) instead of
trusting any particular adapter.

## 3. Primitive ownership

`SqliteStore` owns the connection, journal/busy pragmas, and the transaction
lifecycle. Consumer stores (edge-adapters commerce, agent-policy run-state —
migrated in RFC-007 Phase 1) consolidate their multi-statement mutations onto
two shared primitives, keeping their own schemas and row shapes:

1. **`transactionalSync<T>(fn: (tx: SqliteTx) => T): T`** — runs `fn` inside one
   SQLite transaction; every statement in `fn` commits together; throwing rolls
   the whole batch back. `SqliteTx` offers `run`/`get`/`all`/`cas`/`exec` against
   the same connection. Statements accept positional `?` params bound via
   `SqliteBind` (`string | number | bigint | null | Buffer | Uint8Array`).

2. **`transitionAndEnqueue(options): Promise<boolean>`** — the generalized
   transition of RFC-007 §4.2: a revision-guarded CAS `UPDATE` plus outbox-style
   `INSERT`s committed atomically. If the CAS touches zero rows the whole batch
   rolls back (nothing enqueued) and `false` is returned. This preserves the
   "negotiation CAS + outbox enqueue must be atomic" invariant in commerce, and
   the "reservation update + mandate usage update must be atomic" invariant in
   run-state.

The KV surface (`get/set/remove/clear/keys/has`, `conditionalUpdate`,
`transaction()`) is a thin revision-based layer over the same connection; its
statements are prepared lazily (`kv()`) so a store can be opened on an existing
database that has no `totemsdk_kv` table (`createKvTable: false`).

## 4. Artifact boundary

`ArtifactStore` stores content-addressed bytes behind a pluggable
`ArtifactStoreBackend`. Puts are addressed by `ArtifactRef` (algorithm + digest);
reads are **digest-verified** and return `ok | not-found | corrupt | unavailable`
instead of throwing. The SDK ships `LocalFileBackend`; external stores adapt by
config, and earn "tested contract" status by passing `runBackendConformance`.

## 5. storage → core one-way DAG

`@totemsdk/storage` depends only on `@totemsdk/core` (for the base
`StorageAdapter`). Nothing in core (or any package upstream of core) may import
storage. This is enforced by `scripts/verify-storage-dag.mjs`, which fails the
build on any `@totemsdk/storage` import appearing in a package that is a
transitive dependency of storage.

## 6. Conformance

Every adapter runs the identical `runCoreConformance` suite; every artifact
backend runs `runBackendConformance`. Because the suite is shared, switching a
backing store under an unchanged consumer is behavior-preserving by contract —
this is what makes RFC-007 migrations low-risk: records are replayed through the
same vocabulary and verified by the same conformance harness on the new store.
