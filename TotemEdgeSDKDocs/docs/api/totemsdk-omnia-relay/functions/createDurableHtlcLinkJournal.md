[**@totemsdk/omnia-relay**](../index.md)

***

[@totemsdk/omnia-relay](../index.md) / createDurableHtlcLinkJournal

# Function: createDurableHtlcLinkJournal()

> **createDurableHtlcLinkJournal**(`storage`): [`DurableHtlcLinkJournal`](../interfaces/DurableHtlcLinkJournal.md)

Storage-backed link journal. `storage` may be any `StorageAdapter`
(in-memory, JSON file, SQLite) so the host can share its durable store.

## Parameters

### storage

`StorageAdapter`

## Returns

[`DurableHtlcLinkJournal`](../interfaces/DurableHtlcLinkJournal.md)
