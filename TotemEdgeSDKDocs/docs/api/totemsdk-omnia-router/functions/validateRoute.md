[**@totemsdk/omnia-router**](../index.md)

***

[@totemsdk/omnia-router](../index.md) / validateRoute

# Function: validateRoute()

> **validateRoute**(`channels`, `route`, `binding?`): [`RouteValidationResult`](../type-aliases/RouteValidationResult.md)

Validate a route against live channel state **and** against what the payment
is supposed to do (OMN-080).

Per-hop checks answer "can this channel spend?". They do not answer "does
this route pay the right party the right amount?" — an empty route, a route
whose hops do not connect, or a route that delivers a different amount all
used to pass. `binding` supplies the intent; when it is omitted the route is
still required to be non-empty and internally consistent.

## Parameters

### channels

`Map`\<`string`, [`RouterChannel`](../interfaces/RouterChannel.md)\>

### route

[`Route`](../interfaces/Route.md)

### binding?

[`RouteBinding`](../interfaces/RouteBinding.md) = `{}`

## Returns

[`RouteValidationResult`](../type-aliases/RouteValidationResult.md)
