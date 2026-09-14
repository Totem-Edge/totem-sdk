[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / idempotencyKey

# Function: idempotencyKey()

> **idempotencyKey**(`purchaseId`, `agreementId`, `operation`): `string`

Derive a stable idempotency key for a side-effecting operation.

## Parameters

### purchaseId

`string`

### agreementId

`string`

### operation

`"payment"` \| `"resource-start"` \| `"settlement"` \| `"receipt"`

## Returns

`string`
