[**@totemsdk/omnia-router**](../index.md)

***

[@totemsdk/omnia-router](../index.md) / planRouteExpiry

# Function: planRouteExpiry()

> **planRouteExpiry**(`channels`, `route`, `expiryBlock`, `lockCount`, `policy?`): [`ExpiryPlanResult`](../type-aliases/ExpiryPlanResult.md)

Derive the expiry delta for a route and check it fits the requested window.

`lockCount` is the number of HTLC locks the execution will place — one per
routing hop, two per swap hop — not the number of route hops.

## Parameters

### channels

`Map`\<`string`, [`RouterChannel`](../interfaces/RouterChannel.md)\>

### route

[`Route`](../interfaces/Route.md)

### expiryBlock

`bigint`

### lockCount

`number`

### policy?

[`ExpiryPolicy`](../interfaces/ExpiryPolicy.md) = `{}`

## Returns

[`ExpiryPlanResult`](../type-aliases/ExpiryPlanResult.md)
