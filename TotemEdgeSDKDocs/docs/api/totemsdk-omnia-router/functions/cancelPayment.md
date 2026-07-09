[**@totemsdk/omnia-router**](../index.md)

***

[@totemsdk/omnia-router](../index.md) / cancelPayment

# Function: cancelPayment()

> **cancelPayment**(`ops`, `channels`, `route`, `leaseProviders`): `Promise`\<`void`\>

Cancel all pending HTLCs on a route by calling timeoutHTLC on each hop.
Call this explicitly to roll back before or without attempting execution.

## Parameters

### ops

[`ChannelOps`](../interfaces/ChannelOps.md)

### channels

`Map`\<`string`, [`RouterChannel`](../interfaces/RouterChannel.md)\>

### route

[`Route`](../interfaces/Route.md)

### leaseProviders

`Map`\<`string`, `unknown`\>

## Returns

`Promise`\<`void`\>
