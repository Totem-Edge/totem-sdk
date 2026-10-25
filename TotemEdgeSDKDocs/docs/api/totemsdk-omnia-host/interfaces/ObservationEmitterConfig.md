[**@totemsdk/omnia-host**](../index.md)

***

[@totemsdk/omnia-host](../index.md) / ObservationEmitterConfig

# Interface: ObservationEmitterConfig

## Properties

### bus

> **bus**: [`ObservationBus`](../classes/ObservationBus.md)

***

### networkId

> **networkId**: `string`

***

### onError?

> `optional` **onError?**: (`error`) => `void`

Called on emission failures (defaults to console.error).

#### Parameters

##### error

`unknown`

#### Returns

`void`

***

### simulated?

> `optional` **simulated?**: `boolean`

Mark events from fixture/simulated hosts.

***

### sourceNodeId

> **sourceNodeId**: `string`

***

### store

> **store**: [`ObservationStore`](ObservationStore.md)

***

### streamId?

> `optional` **streamId?**: `string`
