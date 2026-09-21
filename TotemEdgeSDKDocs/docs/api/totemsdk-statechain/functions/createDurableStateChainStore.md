[**@totemsdk/statechain**](../index.md)

***

[@totemsdk/statechain](../index.md) / createDurableStateChainStore

# Function: createDurableStateChainStore()

> **createDurableStateChainStore**(`adapter`, `options?`): [`DurableStateChainStore`](../interfaces/DurableStateChainStore.md)

Create a durable `StateChain` registry over a CAS-capable adapter.

The whole registry is one revision-CAS snapshot record, keyed under the
configured namespace. A `MemoryStore` (volatile ack) requires
`requireAckMode: 'volatile'` — pass it explicitly so a production caller
can never accidentally downgrade durability (RFC-007 §4.2 no-silent-downgrade).

## Parameters

### adapter

`StorageAdapter`

### options?

[`DurableStateChainStoreOptions`](../interfaces/DurableStateChainStoreOptions.md) = `{}`

## Returns

[`DurableStateChainStore`](../interfaces/DurableStateChainStore.md)
