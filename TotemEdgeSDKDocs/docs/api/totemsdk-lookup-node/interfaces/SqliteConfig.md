[**@totemsdk/lookup-node**](../index.md)

***

[@totemsdk/lookup-node](../index.md) / SqliteConfig

# Interface: SqliteConfig

SQLite storage configuration. Defaults to ':memory:' if omitted.

## Properties

### cacheTtlMs?

> `optional` **cacheTtlMs?**: `number`

TTL for result cache entries in ms. Default: 30_000

***

### dbPath

> **dbPath**: `string`

Path to the SQLite database file. Use ':memory:' for ephemeral storage.
