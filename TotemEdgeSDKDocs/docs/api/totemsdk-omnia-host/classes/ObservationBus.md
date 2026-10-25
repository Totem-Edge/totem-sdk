[**@totemsdk/omnia-host**](../index.md)

***

[@totemsdk/omnia-host](../index.md) / ObservationBus

# Class: ObservationBus

In-process live fan-out for SSE consumers. The durable journal remains the
source of truth: a subscriber that misses a live event still replays it from
`ObservationStore.readSince(cursor)`.

## Constructors

### Constructor

> **new ObservationBus**(): `ObservationBus`

#### Returns

`ObservationBus`

## Accessors

### size

#### Get Signature

> **get** **size**(): `number`

##### Returns

`number`

## Methods

### publish()

> **publish**(`observation`): `void`

#### Parameters

##### observation

[`OmniaObservation`](../interfaces/OmniaObservation.md)

#### Returns

`void`

***

### subscribe()

> **subscribe**(`listener`): () => `void`

#### Parameters

##### listener

[`ObservationListener`](../type-aliases/ObservationListener.md)

#### Returns

() => `void`
