[**@totemsdk/omnia-router**](../index.md)

***

[@totemsdk/omnia-router](../index.md) / findCrossTokenRoute

# Function: findCrossTokenRoute()

> **findCrossTokenRoute**(`graph`, `from`, `to`, `amountIn`, `tokenIn`, `tokenOut`, `opts?`): [`CrossTokenRoute`](../interfaces/CrossTokenRoute.md) \| `null`

Find a cross-token route where the sender spends `tokenIn` and the
recipient receives `tokenOut`.  The path may include one or more swap hops
provided by bridging intermediaries registered via announceSwap.

Selection criteria: lowest total fee (including swap fee), then fewest hops,
then fewest swap hops.

## Parameters

### graph

[`ChannelGraph`](../interfaces/ChannelGraph.md)

### from

`string`

### to

`string`

### amountIn

`bigint`

### tokenIn

`string`

### tokenOut

`string`

### opts?

[`RouteOptions`](../interfaces/RouteOptions.md)

## Returns

[`CrossTokenRoute`](../interfaces/CrossTokenRoute.md) \| `null`
