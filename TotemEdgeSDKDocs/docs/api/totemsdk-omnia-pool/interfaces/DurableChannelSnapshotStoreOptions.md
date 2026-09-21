[**@totemsdk/omnia-pool**](../index.md)

***

[@totemsdk/omnia-pool](../index.md) / DurableChannelSnapshotStoreOptions

# Interface: DurableChannelSnapshotStoreOptions

## Properties

### namespace?

> `readonly` `optional` **namespace?**: `string`

Key namespace prefix; default `totem_omnia_pool:v1:`.

***

### requireAckMode?

> `readonly` `optional` **requireAckMode?**: `"volatile"` \| `"buffered"` \| `"durably-acknowledged"`

Required write acknowledgment; default `durably-acknowledged`. Pass
`volatile` only for tests/scratch adapters (e.g. `MemoryStore`).
