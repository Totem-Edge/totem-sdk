[**@totemsdk/proofgraph**](../index.md)

***

[@totemsdk/proofgraph](../index.md) / DurableProofGraphStoreOptions

# Interface: DurableProofGraphStoreOptions

## Properties

### namespace?

> `optional` **namespace?**: `string`

Key prefix (default 'totem_proofgraph:v1:').

***

### requireAckMode?

> `optional` **requireAckMode?**: `"volatile"` \| `"buffered"` \| `"durably-acknowledged"`

Required write-ack level the backing adapter must satisfy (default
'durably-acknowledged').
