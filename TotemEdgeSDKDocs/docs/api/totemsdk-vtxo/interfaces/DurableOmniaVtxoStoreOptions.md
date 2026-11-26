[**@totemsdk/vtxo**](../index.md)

***

[@totemsdk/vtxo](../index.md) / DurableOmniaVtxoStoreOptions

# Interface: DurableOmniaVtxoStoreOptions

## Properties

### namespace?

> `readonly` `optional` **namespace?**: `string`

Key namespace prefix; default `totem_omnia_vtxo:v1:`.

***

### requireAckMode?

> `readonly` `optional` **requireAckMode?**: `"durably-acknowledged"` \| `"volatile"` \| `"buffered"`

Required write acknowledgment; default `durably-acknowledged`. Pass
`volatile` only for tests/scratch adapters (e.g. `MemoryStore`).
