[**@totemsdk/omnia-router**](../index.md)

***

[@totemsdk/omnia-router](../index.md) / buildPaymentRequest

# Function: buildPaymentRequest()

> **buildPaymentRequest**(`amount`, `tokenId`, `expiryBlock`, `description?`): [`PaymentRequest`](../interfaces/PaymentRequest.md)

Generate a random 32-byte preimage, compute SHA3-256(preimage) as the
hashlock, and return a PaymentRequest that is ready to share.

The returned PaymentRequest includes the `preimage` field so the payer
can call executeMultiHopPayment.  Strip `preimage` before forwarding the
request to intermediaries.

Compatible with Bare/Pear environments: uses globalThis.crypto.getRandomValues
(Web Crypto API, available in Node ≥18, browsers, and Pear/Bare runtimes).

## Parameters

### amount

`bigint`

### tokenId

`string`

### expiryBlock

`bigint`

### description?

`string`

## Returns

[`PaymentRequest`](../interfaces/PaymentRequest.md)
