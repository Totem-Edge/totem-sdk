[**@totemsdk/edge-adapters**](../index.md)

***

[@totemsdk/edge-adapters](../index.md) / PurchasePaymentAdapterConfig

# Interface: PurchasePaymentAdapterConfig

## Properties

### port

> **port**: `PaymentPortLike`

The underlying payment port (L1/L2/hosted).

***

### store?

> `optional` **store?**: `object`

Optional durable idempotency store. When omitted, an in-memory map is
used (dev mode — no crash guarantees). A durable store (e.g. the
CommerceStore) makes retries safe across restarts.

#### get()

> **get**(`key`): `Promise`\<`EdgeOperationResult`\<`PaymentResult`\> \| `undefined`\>

##### Parameters

###### key

`string`

##### Returns

`Promise`\<`EdgeOperationResult`\<`PaymentResult`\> \| `undefined`\>

#### set()

> **set**(`key`, `result`): `Promise`\<`void`\>

##### Parameters

###### key

`string`

###### result

`EdgeOperationResult`\<`PaymentResult`\>

##### Returns

`Promise`\<`void`\>
