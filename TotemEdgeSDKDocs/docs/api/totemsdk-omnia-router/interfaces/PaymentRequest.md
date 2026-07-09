[**@totemsdk/omnia-router**](../index.md)

***

[@totemsdk/omnia-router](../index.md) / PaymentRequest

# Interface: PaymentRequest

## Properties

### amount

> **amount**: `bigint`

***

### description?

> `optional` **description?**: `string`

***

### expiryBlock

> **expiryBlock**: `bigint`

***

### hashlock

> **hashlock**: `string`

SHA3-256 hex of preimage

***

### preimage?

> `optional` **preimage?**: `string`

Known to the payer (returned by buildPaymentRequest).
Strip this before sharing the request with intermediaries.

***

### tokenId

> **tokenId**: `string`
