[**@totemsdk/provider-bond**](../index.md)

***

[@totemsdk/provider-bond](../index.md) / DurableProviderBondStoreOptions

# Interface: DurableProviderBondStoreOptions

## Properties

### namespace?

> `readonly` `optional` **namespace?**: `string`

Key namespace prefix; default `totem_bond:v1:`.

***

### requireAckMode?

> `readonly` `optional` **requireAckMode?**: `"volatile"` \| `"buffered"` \| `"durably-acknowledged"`

Required write acknowledgment; default `durably-acknowledged`. Pass
`volatile` only for tests/scratch adapters (e.g. `MemoryStore`).
