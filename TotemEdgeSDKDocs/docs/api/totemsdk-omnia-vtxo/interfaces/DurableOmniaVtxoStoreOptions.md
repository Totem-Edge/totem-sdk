[**@totemsdk/omnia-vtxo**](../index.md)

***

[@totemsdk/omnia-vtxo](../index.md) / DurableOmniaVtxoStoreOptions

# Interface: DurableOmniaVtxoStoreOptions

## Properties

### namespace?

> `readonly` `optional` **namespace?**: `string`

Key namespace prefix; default `totem_omnia_vtxo:v1:`.

***

### requireAckMode?

> `readonly` `optional` **requireAckMode?**: `"volatile"` \| `"buffered"` \| `"durably-acknowledged"`

Required write acknowledgment; default `durably-acknowledged`. Pass
`volatile` only for tests/scratch adapters (e.g. `MemoryStore`).
