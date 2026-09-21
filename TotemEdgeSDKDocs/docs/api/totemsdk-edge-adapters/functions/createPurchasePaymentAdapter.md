[**@totemsdk/edge-adapters**](../index.md)

***

[@totemsdk/edge-adapters](../index.md) / createPurchasePaymentAdapter

# Function: createPurchasePaymentAdapter()

> **createPurchasePaymentAdapter**(`config`): `object`

Create a PurchasePaymentPort with an atomic idempotency-key claim.

## Parameters

### config

[`PurchasePaymentAdapterConfig`](../interfaces/PurchasePaymentAdapterConfig.md)

## Returns

`object`

### pay()

> **pay**(`params`): `Promise`\<`EdgeOperationResult`\<`PaymentResult`\>\>

#### Parameters

##### params

###### amount

`string`

###### idempotencyKey?

`string`

###### memo?

`string`

###### recipient

`string`

###### tokenId?

`string`

#### Returns

`Promise`\<`EdgeOperationResult`\<`PaymentResult`\>\>
