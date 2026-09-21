[**@totemsdk/proofgraph**](../index.md)

***

[@totemsdk/proofgraph](../index.md) / createDurableProofGraphStore

# Function: createDurableProofGraphStore()

> **createDurableProofGraphStore**(`adapter`, `options?`): [`DurableProofGraphStore`](../type-aliases/DurableProofGraphStore.md)

Create a durable `ProofGraphStoragePort` over a CAS-capable adapter.

The head pointer and every reverse-index entry are guarded with the
adapter's `conditionalUpdate`, and all mutations run serialized per adapter,
so concurrent saves never clobber a newer graph. A non-CAS or low-durability
adapter is rejected at construction (RFC-007 §4.2 no-silent-downgrade).

## Parameters

### adapter

`StorageAdapter`

### options?

[`DurableProofGraphStoreOptions`](../interfaces/DurableProofGraphStoreOptions.md) = `{}`

## Returns

[`DurableProofGraphStore`](../type-aliases/DurableProofGraphStore.md)
