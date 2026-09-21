[**@totemsdk/omnia-host**](../index.md)

***

[@totemsdk/omnia-host](../index.md) / InProcessRoutingProvider

# Class: InProcessRoutingProvider

Default in-process TypeScript routing engine.

## Implements

- [`RoutingProvider`](../interfaces/RoutingProvider.md)

## Constructors

### Constructor

> **new InProcessRoutingProvider**(): `InProcessRoutingProvider`

#### Returns

`InProcessRoutingProvider`

## Methods

### getRoute()

> **getRoute**(`query`): `Route` \| `CrossTokenRoute` \| `null`

#### Parameters

##### query

[`RouteQuery`](../interfaces/RouteQuery.md)

#### Returns

`Route` \| `CrossTokenRoute` \| `null`

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
