# `@totemsdk/storage`

Provider-neutral storage contracts and adapters for the Totem SDK
([RFC-007](docs/rfc/RFC-007-STORAGE-CONSOLIDATION.md)).

## Scope

This package is the durable-guarantee substrate for every Totem package that
persists state. It ships the storage vocabulary, the adapter ports, and the
shared SQLite primitives that consumer stores consolidate onto. It knows
nothing about QVAC, RAG workspaces, or inference.

- Dependency direction is one-way: **`@totemsdk/storage` → `@totemsdk/core`**.
  Core never imports storage (enforced by `scripts/verify-storage-dag.mjs`).
- The base `StorageAdapter` interface comes from `@totemsdk/core` and is
  re-exported, never shadowed.
- The package is **provider-** and **platform-neutral**: Node `fs` and native
  `better-sqlite3` live behind isolated subpaths (`./fs`, `./sqlite`); the
  neutral surface (`@totemsdk/storage`) never imports native bindings.

## Deliverables

| Area | Surface |
|------|---------|
| Error taxonomy | `StorageError`: `not-found` \| `corrupt` \| `unavailable` \| `write-failed` — absent vs broken vs down are always distinct |
| Versioned codec | `codec` — versioned `serialize`/`deserialize` with in-band `bigint`/`Uint8Array` tags, distinct from signed canonicalization |
| Namespace | Prefix-scoped `keys()`/`clear()` — shared directories safe by construction |
| Transactions + CAS | `Transaction` (get/set/remove/commit) + revision-based `conditionalUpdate` on `CasStore` |
| Relational primitives | `SqliteStore.transactionalSync(…)` + `transitionAndEnqueue(…)` — atomic batches and CAS+outbox enqueue consumers consolidate onto |
| Write acknowledgment | `volatile` \| `buffered` \| `durably-acknowledged`, declared per store |
| Failure policy | `strict` \| `lenient`, separate from durability |
| No-silent-downgrade | `assertCapabilities` — consumers reject adapters that can't provide required guarantees |
| Artifact boundary | `ArtifactStore` over a pluggable `ArtifactStoreBackend` port + digest-verified reads |
| Conformance | `./conformance` — the same core suite + backend suite, so contracts are verified identically on every adapter |

## Module map

| Subpath | Exports |
|---------|---------|
| `@totemsdk/storage` | neutral surface: errors, codec, types, namespace, transaction, memory-store, artifacts |
| `/sqlite` | `SqliteStore`, `SqliteTx`, `SqliteBind`, `TransitionAndEnqueueOptions` (native `better-sqlite3`; never imported by the neutral surface) |
| `/fs` | `FileStore` |
| `/memory` | `MemoryStore` |
| `/artifacts` | `ArtifactStore`, artifact types |
| `/artifacts/local-fs-backend` | `LocalFileBackend` |
| `/codec` | `codec`, `CODEC_MAGIC`, `CODEC_VERSION` |
| `/conformance` | `runCoreConformance`, `runBackendConformance` |
| `/errors`, `/namespace`, `/transaction`, `/types` | scoped re-exports |

## Adapters and guarantees

| Adapter | Acknowledge | Atomic | Conditional | Notes |
|---------|-------------|--------|-------------|-------|
| `SqliteStore` | `durably-acknowledged` | yes | yes | WAL + `synchronous=FULL`; `busy_timeout`; optional KV table, `foreignKeys`, WAL toggle |
| `FileStore` | `durably-acknowledged` | yes | yes | fsync-per-write atomic replace |
| `MemoryStore` | `volatile` | yes | yes | ephemeral tests only |

Every adapter passes the identical `runCoreConformance` suite, so switching a
backing store under an unchanged consumer is a one-line change. Consumers that
require a given guarantee call `assertCapabilities` once at startup.

## Quick start

```ts
import { SqliteStore } from '@totemsdk/storage/sqlite';
import { Namespace, assertCapabilities } from '@totemsdk/storage';

const store = new SqliteStore('data.db'); // durably-acknowledged
assertCapabilities(store, { acknowledge: 'durably-acknowledged', atomic: true });

await store.set('k', { v: 1n, bytes: new Uint8Array([1, 2]) });
const ledger = new Namespace(store, 'ledger:');
await ledger.set('counter', 3);
```

### Atomic batches with rollback

```ts
// All statements in fn commit together; a throw rolls the whole batch back.
const saved = store.transactionalSync((tx) => {
  tx.run('UPDATE accounts SET balance = balance - ? WHERE id = ?', 10, 'a');
  tx.run('UPDATE accounts SET balance = balance + ? WHERE id = ?', 10, 'b');
  return tx.get('SELECT balance FROM accounts WHERE id = ?', 'b');
});
```

### `transitionAndEnqueue` (CAS + outbox in one commit)

The generalized transition: a revision-guarded `UPDATE` and an outbox enqueue
commit atomically (RFC-007 §4.2). If the CAS touches zero rows the whole batch
rolls back and `false` is returned — nothing is enqueued.

```ts
const ok = await store.transitionAndEnqueue({
  casUpdateSql: 'UPDATE negotiations SET record_json = ? WHERE negotiation_id = ? AND revision = ?',
  casUpdateParams: [nextJson, id, expectedRevision],
  enqueueSql: 'INSERT OR REPLACE INTO outbox (message_id, recipient, payload, enqueued_at) VALUES (?, ?, ?, ?)',
  enqueueRows: messages.map((m) => [m.messageId, m.recipient, m.payload, Date.now()]),
});
```

`SqliteStore` owns connection, WAL/busy pragmas, and the transaction lifecycle;
consumer stores (e.g. `@totemsdk/edge-adapters` commerce, `@totemsdk/agent-policy`
run-state, migrated in RFC-007 Phase 1) keep their own schemas and row shapes
("records unchanged in shape").

### Artifacts (content-addressed byte storage)

```ts
import { ArtifactStore } from '@totemsdk/storage/artifacts';
import { LocalFileBackend } from '@totemsdk/storage/artifacts/local-fs-backend';

const store = new ArtifactStore(new LocalFileBackend('./artifacts'));
const { ref } = await store.put('evidence', new Uint8Array(...));

const read = await store.get(ref); // digest-verified: ok | not-found | corrupt | unavailable
```

Any external store (Arweave, Filecoin, IPFS, torrents, Drive, object stores) is
adapted behind `ArtifactStoreBackend` by config — the SDK never maintains a
provider registry. A backend earns "tested contract" status by passing
`runBackendConformance` from `@totemsdk/storage/conformance`.

## Conformance

Adapters and artifact backends must remain green on the shared suites:

```ts
// packages/your-store/src/__tests__/conformance.test.ts
runCoreConformance('MyStore', async () => new MyStore(':memory:'));
```

See [docs/adapter-guide.md](docs/adapter-guide.md) for the authoring checklist.

## Architecture & policies

- [docs/architecture.md](docs/architecture.md) — module layout, write-ack
  semantics, primitive ownership, storage→core DAG.
- [docs/policies.md](docs/policies.md) — durability, CAS/concurrency,
  data-at-rest, artifact digest verification, and no-silent-downgrade policies.
- Root security posture: [SECURITY.md](../../SECURITY.md),
  [docs/security/crypto-policy.md](../../docs/security/crypto-policy.md) —
  storage never persists private keys (only stable references/IDs); key material
  at rest must follow crypto-policy §11 (AES-256-GCM, encrypted).

## License

MIT. See [LICENSE](LICENSE).
