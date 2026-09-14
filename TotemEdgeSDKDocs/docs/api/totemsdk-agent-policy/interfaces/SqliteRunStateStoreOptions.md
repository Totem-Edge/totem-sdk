[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / SqliteRunStateStoreOptions

# Interface: SqliteRunStateStoreOptions

## Properties

### now?

> `optional` **now?**: () => `number`

Injectable clock (defaults to Date.now).

#### Returns

`number`

***

### ttlMs?

> `optional` **ttlMs?**: `number`

Reservation TTL in ms (default 60_000).
