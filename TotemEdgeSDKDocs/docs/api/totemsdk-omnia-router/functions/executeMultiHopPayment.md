[**@totemsdk/omnia-router**](../index.md)

***

[@totemsdk/omnia-router](../index.md) / executeMultiHopPayment

# Function: executeMultiHopPayment()

> **executeMultiHopPayment**(`ops`, `channels`, `route`, `paymentRequest`, `leaseProviders`): `Promise`\<[`PaymentResult`](../interfaces/PaymentResult.md)\>

Execute a single-token multi-hop payment atomically:

1. Forward phase — lock HTLCs across each hop in route.hops.
2. Reveal phase — reveal preimage via fulfillHTLC in reverse order.

Rollback (best-effort timeoutHTLC on all still-pending locks) fires on ANY
failure, including failures that occur during the reveal phase — so stranded
HTLCs are never left behind silently.

`paymentRequest.preimage` MUST be set (buildPaymentRequest sets it).

The `channels` map is updated in-place after each HTLC operation.

## Parameters

### ops

[`ChannelOps`](../interfaces/ChannelOps.md)

### channels

`Map`\<`string`, [`RouterChannel`](../interfaces/RouterChannel.md)\>

### route

[`Route`](../interfaces/Route.md)

### paymentRequest

[`PaymentRequest`](../interfaces/PaymentRequest.md)

### leaseProviders

`Map`\<`string`, `unknown`\>

## Returns

`Promise`\<[`PaymentResult`](../interfaces/PaymentResult.md)\>
