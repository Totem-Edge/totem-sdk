[**@totemsdk/omnia-router**](../index.md)

***

[@totemsdk/omnia-router](../index.md) / DurableRouterLedgerOptions

# Interface: DurableRouterLedgerOptions

## Properties

### namespace?

> `readonly` `optional` **namespace?**: `string`

Key namespace prefix; default `totem_omnia_router:v1:`.

***

### requireAckMode?

> `readonly` `optional` **requireAckMode?**: `"volatile"` \| `"buffered"` \| `"durably-acknowledged"`

Required write acknowledgment; default `durably-acknowledged`. Pass
`volatile` only for tests/scratch adapters (e.g. `MemoryStore`).
