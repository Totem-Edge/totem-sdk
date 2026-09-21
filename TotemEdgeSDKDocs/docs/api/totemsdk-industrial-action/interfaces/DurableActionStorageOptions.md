[**@totemsdk/industrial-action**](../index.md)

***

[@totemsdk/industrial-action](../index.md) / DurableActionStorageOptions

# Interface: DurableActionStorageOptions

## Properties

### namespace?

> `readonly` `optional` **namespace?**: `string`

Key namespace prefix; default `totem_action:v1:`.

***

### requireAckMode?

> `readonly` `optional` **requireAckMode?**: `"volatile"` \| `"buffered"` \| `"durably-acknowledged"`

Required write acknowledgment; default `durably-acknowledged`. Pass
`volatile` only for tests/scratch adapters (e.g. `MemoryStore`).
