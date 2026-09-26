# Storage adapter authoring guide

How to add a new store adapter, an artifact backend, or migrate a consumer onto
the shared `SqliteStore` primitives — and how each is validated.

## 1. Adding a store adapter

1. Implement `StorageAdapterWithCapabilities` (and, if you support concurrency
   control, `CasStore` + `TransactionalStore`) from `@totemsdk/storage`.
2. Declare real capabilities — durability (`WriteAckMode`), `atomic`, and
   `conditional` — in the `capabilities` field. Do not overclaim: the
   no-silent-downgrade policy depends on consumers trusting the declaration.
3. Expose it behind an isolated subpath (like `/fs`, `/memory`, `/sqlite`) so
   the neutral surface never imports platform-specific code.
4. Raise `StorageError` with the taxonomy codes; keep `not-found` distinct from
   `corrupt`/`unavailable`.
5. Write a conformance test and register the store in the workspace gates:

```ts
import { runCoreConformance } from '@totemsdk/storage/conformance';

const describeAdapter = runCoreConformance('MyStore', () =>
  Promise.resolve(new MyStore(':memory:')),
);
```

The core suite exercises every vocabulary op on your adapter, verifying the
same contract as `SqliteStore`/`FileStore`/`MemoryStore`.

### Browser adapter (`@totemsdk/storage/idb`)

`IdbStore` is the IndexedDB adapter for extension service workers and PWAs. It
stays behind the isolated `@totemsdk/storage/idb` subpath, commits values through
the same versioned codec as `FileStore`/`SqliteStore`, and declares
`{ acknowledge: 'durably-acknowledged', atomic: true, conditional: true }`.
Concurrent `conditionalUpdate` calls are serialized by IndexedDB's per-store
`readwrite` transactions. Tests run against `fake-indexeddb` under the
`testEnvironment: 'node'` Jest project:

```ts
import { IDBFactory } from 'fake-indexeddb';
import { IdbStore } from '@totemsdk/storage/idb';
import { runCoreConformance } from '@totemsdk/storage/conformance';

runCoreConformance('IdbStore', async () => new IdbStore({ factory: new IDBFactory() }));
```

## 2. Adding an artifact backend

Implement `ArtifactStoreBackend`:

- `put(ref, bytes, options): Promise<PutReceipt>` — persist content-addressed
  bytes (idempotent on the same `ref`).
- `get(ref): Promise<artifacts>` — return bytes plus a status:
  `ok | not-found | corrupt | unavailable`.
- `indexEntries(): AsyncIterable` — enumerate entries with digest + algorithm
  (required by `ArtifactStoreIndex` maintenance).

Declare `capabilities` accurately and pass the backend conformance suite:

```ts
import { runBackendConformance } from '@totemsdk/storage/conformance';

runBackendConformance('MyBackend', () =>
  Promise.resolve(new MyBackend({ baseDir: tmpdir() })),
);
```

Wire it by config in the consumer, never by registering it in the SDK.

## 3. Migrating a consumer onto `SqliteStore` primitives

Consumers that persisted directly on better-sqlite3 (e.g.
`@totemsdk/edge-adapters` commerce, `@totemsdk/agent-policy` run-state, migrated
in RFC-007 Phase 1) consolidate onto the shared primitives:

1. Own your schema: keep the DDL, tables, and row shapes byte-for-byte
   **unchanged** ("records unchanged in shape"). Migration is about the
   *connection/transaction ownership*, not the data model.
2. Open the store with `new SqliteStore(path, { createKvTable: false })` —
   you run your own tables, you don't want the KV table. Set the options that
   match your previous driver setup (`wal`, `foreignKeys: true`, etc.).
3. Replace `db.transaction(() => …)()` batches with
   `store.transactionalSync((tx) => …)`.
4. Replace a CAS-guarded update plus an outbox/usage enqueue with
   `store.transactionAndEnqueue`-style calls:
   `store.transitionAndEnqueue({ casUpdateSql, casUpdateParams, enqueueSql, enqueueRows })`.
5. Keep your public store `close(): void` by delegating
   `close() { void this.store.close(); }`.
6. Do not persist private keys; stores hold stable references only.

### Migration checklist

- [ ] Schemas/tables/row shapes unchanged.
- [ ] Every multi-statement mutation is inside one `transactionalSync`/`transitionAndEnqueue`.
- [ ] CAS misses return `false`/re-throw `write-failed`, never a silent no-op.
- [ ] `close()` present and idempotent.
- [ ] Conformance suite green; consumer reopen (file-path) test retained.
- [ ] `assertCapabilities` (if the consumer declares durability needs).
- [ ] Workspace: `@totemsdk/storage` added as a dependency; jest moduleNameMapper
  + ts-jest `paths` for `@totemsdk/storage` and `@totemsdk/storage/sqlite`;
  `SDK_MANIFEST.json` entry updated.

## 4. Getting a release

Publishable packages are auto-included by
`scripts/resolve-release-matrix.mjs`; release with a `totemsdk/<pkg>-v<x.y.z>`
tag (see `.github/workflows/publish-totemsdk.yml`). Keep the
`verify-workspace.mjs --lint/--typecheck/--test`, `verify-sdk-manifest.mjs`,
and `verify-storage-dag.mjs` gates green.
