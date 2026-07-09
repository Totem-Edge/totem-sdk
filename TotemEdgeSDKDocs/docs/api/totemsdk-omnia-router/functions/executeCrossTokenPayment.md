[**@totemsdk/omnia-router**](../index.md)

***

[@totemsdk/omnia-router](../index.md) / executeCrossTokenPayment

# Function: executeCrossTokenPayment()

> **executeCrossTokenPayment**(`ops`, `channels`, `route`, `paymentRequest`, `leaseProviders`): `Promise`\<[`PaymentResult`](../interfaces/PaymentResult.md)\>

Execute a cross-token payment atomically.

For each SwapHop:
  1. Lock the inbound HTLC (tokenIn side).
  2. Lock the outbound HTLC (tokenOut side).
  Both use the same hashlock — the intermediary can only claim by revealing
  the preimage on both sides simultaneously.

Then forward-locks all remaining non-swap hops, and reveals the preimage
backwards across all locked channels.

Rollback fires on ANY failure (forward OR backward phase) by timing out
all still-pending locked HTLCs.

## Parameters

### ops

[`ChannelOps`](../interfaces/ChannelOps.md)

### channels

`Map`\<`string`, [`RouterChannel`](../interfaces/RouterChannel.md)\>

### route

[`CrossTokenRoute`](../interfaces/CrossTokenRoute.md)

### paymentRequest

[`PaymentRequest`](../interfaces/PaymentRequest.md)

### leaseProviders

`Map`\<`string`, `unknown`\>

## Returns

`Promise`\<[`PaymentResult`](../interfaces/PaymentResult.md)\>
