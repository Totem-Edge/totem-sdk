# `@totemsdk/storage`

Provider-neutral storage contracts and adapters for the Totem SDK
([RFC-007](docs/rfc/RFC-007-STORAGE-CONSOLIDATION.md)).

## Scope

This package is the durable-guarantee substrate for every Totem package that
persists state. It ships the storage vocabulary and the adapter ports; it knows
nothing about QVAC, RAG workspaces, or inference.

- Dependency direction is one-way: **`@totemsdk/storage` → `@totemsdk/core`**.
  Core never imports storage.
- The base `StorageAdapter` interface comes from `@totemsdk/core` and is
  re-exported, never shadowed.
- The package is **provider-neutral** and platform-neutral: Node `fs` and native
  `better-sqlite3` live behind isolated subpaths (`./fs`, `./sqlite`).

## Deliverables

| Area | Surface |
|------|---------|
| Error taxonomy | `StorageError`: `not-found` \| `corrupt` \| `unavailable` \| `write-failed` — absent vs broken vs down are always distinct |
| Versioned codec | `codec` — versioned `serialize`/`deserialize` with in-band `bigint`/`Uint8Array` tags, distinct from signed canonicalization |
| Namespace | Prefix-scoped `keys()`/`clear()` — shared directories safe by construction |
| Transactions + CAS | `Transaction` (get/set/remove/commit) + revision-based `conditionalUpdate` |
| Write acknowledgment | `volatile` \| `buffered` \| `durably-acknowledged`, declared per store |
| Failure policy | `strict` \| `lenient`, separate from durability |
| No-silent-downgrade | `assertCapabilities` — consumers reject adapters that can't provide required guarantees |
| Artifact boundary | `ArtifactStore` over a pluggable `ArtifactStoreBackend` port + `ArtifactStore` digest-verified reads |
| Conformance | `./conformance` — the same core suite + backend suite, so contracts are verified identically on every adapter |

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

## Badges / license

MIT. See [LICENSE](LICENSE).