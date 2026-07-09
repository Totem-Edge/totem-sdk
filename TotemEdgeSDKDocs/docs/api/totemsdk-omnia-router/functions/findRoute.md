[**@totemsdk/omnia-router**](../index.md)

***

[@totemsdk/omnia-router](../index.md) / findRoute

# Function: findRoute()

> **findRoute**(`graph`, `from`, `to`, `amount`, `tokenId`, `opts?`): [`Route`](../interfaces/Route.md) \| `null`

Find the cheapest route (lowest total fee, then fewest hops) from `from` to
`to` carrying `amount` of `tokenId`.  Edges are filtered by tokenId and
availableBalance.

Returns null if no path exists within maxHops.

## Parameters

### graph

[`ChannelGraph`](../interfaces/ChannelGraph.md)

### from

`string`

### to

`string`

### amount

`bigint`

### tokenId

`string`

### opts?

[`RouteOptions`](../interfaces/RouteOptions.md)

## Returns

[`Route`](../interfaces/Route.md) \| `null`
