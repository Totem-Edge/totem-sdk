[**@totemsdk/omnia-router**](../index.md)

***

[@totemsdk/omnia-router](../index.md) / buildCrossTokenRequest

# Function: buildCrossTokenRequest()

> **buildCrossTokenRequest**(`amountOut`, `tokenOut`, `expiryBlock`, `description?`): [`PaymentRequest`](../interfaces/PaymentRequest.md)

Recipient-side variant: generates a payment request for the token they want
to receive.  The API is identical to buildPaymentRequest — the distinction
is conceptual (recipient generates hashlock; sender sources liquidity).

## Parameters

### amountOut

`bigint`

### tokenOut

`string`

### expiryBlock

`bigint`

### description?

`string`

## Returns

[`PaymentRequest`](../interfaces/PaymentRequest.md)
