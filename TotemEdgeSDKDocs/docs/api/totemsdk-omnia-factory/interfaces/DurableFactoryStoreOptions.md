[**@totemsdk/omnia-factory**](../index.md)

***

[@totemsdk/omnia-factory](../index.md) / DurableFactoryStoreOptions

# Interface: DurableFactoryStoreOptions

## Properties

### namespace?

> `readonly` `optional` **namespace?**: `string`

Key namespace prefix; default `totem_omnia_factory:v1:`.

***

### requireAckMode?

> `readonly` `optional` **requireAckMode?**: `"volatile"` \| `"buffered"` \| `"durably-acknowledged"`

Required write acknowledgment; default `durably-acknowledged`. Pass
`volatile` only for tests/scratch adapters (e.g. `MemoryStore`).
