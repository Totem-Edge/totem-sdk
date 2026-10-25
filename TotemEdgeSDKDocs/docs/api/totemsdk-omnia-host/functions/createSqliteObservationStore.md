[**@totemsdk/omnia-host**](../index.md)

***

[@totemsdk/omnia-host](../index.md) / createSqliteObservationStore

# Function: createSqliteObservationStore()

> **createSqliteObservationStore**(`dbPath`, `options?`): `Promise`\<[`ObservationStore`](../interfaces/ObservationStore.md)\>

Durable observation journal backed by `@totemsdk/storage` (RFC-007).

Deliberately **not** a direct `better-sqlite3`/DuckDB write: omnia-host
persists through the storage SDK so the same adapter can be swapped
(file/idb/memory) and the journal gets CAS head sequencing, crash-recovery and
forward-migratable records for free.

## Parameters

### dbPath

`string`

### options?

[`SqliteObservationStoreOptions`](../interfaces/SqliteObservationStoreOptions.md) = `{}`

## Returns

`Promise`\<[`ObservationStore`](../interfaces/ObservationStore.md)\>
