[**@totemsdk/edge-adapters**](../index.md)

***

[@totemsdk/edge-adapters](../index.md) / PurchasePaymentAdapterConfig

# Interface: PurchasePaymentAdapterConfig

## Properties

### namespace?

> `optional` **namespace?**: `string`

Key namespace prefix; default `totem_payment:v1:`.

***

### port

> **port**: `PaymentPortLike`

The underlying payment port (L1/L2/hosted).

***

### requireAckMode?

> `optional` **requireAckMode?**: `"volatile"` \| `"buffered"` \| `"durably-acknowledged"`

Required write acknowledgment for a supplied store; default `durably-acknowledged`.

***

### store?

> `optional` **store?**: [`PurchasePaymentStore`](../type-aliases/PurchasePaymentStore.md)

Optional claim store. When omitted, a dev in-memory store is used (no
crash guarantees and no cross-instance dedup). A durable CAS-capable
store (e.g. a `@totemsdk/storage` FileStore/SqliteStore) makes retries
safe across restarts and processes. No silent downgrade: a supplied
store is asserted CAS-capable and `durably-acknowledged` unless
`requireAckMode` opts into a weaker acknowledgment.
