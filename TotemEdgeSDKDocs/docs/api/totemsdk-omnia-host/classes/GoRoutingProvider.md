[**@totemsdk/omnia-host**](../index.md)

***

[@totemsdk/omnia-host](../index.md) / GoRoutingProvider

# Class: GoRoutingProvider

Optional phase-10 provider for a compiled Go router speaking JSONL over stdio.

## Implements

- [`RoutingProvider`](../interfaces/RoutingProvider.md)

## Constructors

### Constructor

> **new GoRoutingProvider**(`binaryPath?`): `GoRoutingProvider`

#### Parameters

##### binaryPath?

`string` = `'omnia-router'`

#### Returns

`GoRoutingProvider`

## Methods

### close()

> **close**(): `void`

#### Returns

`void`

***

### getRoute()

> **getRoute**(`query`): `Promise`\<`Route` \| `CrossTokenRoute` \| `null`\>

#### Parameters

##### query

[`RouteQuery`](../interfaces/RouteQuery.md)

#### Returns

`Promise`\<`Route` \| `CrossTokenRoute` \| `null`\>

#### Implementation of

[`RoutingProvider`](../interfaces/RoutingProvider.md).[`getRoute`](../interfaces/RoutingProvider.md#getroute)

***

### rebuild()

> **rebuild**(`edges`): `void`

#### Parameters

##### edges

`Iterable`\<`ChannelGraphEdge`\>

#### Returns

`void`

#### Implementation of

[`RoutingProvider`](../interfaces/RoutingProvider.md).[`rebuild`](../interfaces/RoutingProvider.md#rebuild)
