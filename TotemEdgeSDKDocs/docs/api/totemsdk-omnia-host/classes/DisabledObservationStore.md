[**@totemsdk/omnia-host**](../index.md)

***

[@totemsdk/omnia-host](../index.md) / DisabledObservationStore

# Class: DisabledObservationStore

No-op store for read-only/embedded deployments that opt out of observation.

## Implements

- [`ObservationStore`](../interfaces/ObservationStore.md)

## Constructors

### Constructor

> **new DisabledObservationStore**(): `DisabledObservationStore`

#### Returns

`DisabledObservationStore`

## Methods

### append()

> **append**(): `Promise`\<\{ `createdAt`: `number`; `seq`: `number`; \}\>

#### Returns

`Promise`\<\{ `createdAt`: `number`; `seq`: `number`; \}\>

#### Implementation of

[`ObservationStore`](../interfaces/ObservationStore.md).[`append`](../interfaces/ObservationStore.md#append)

***

### close()

> **close**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`ObservationStore`](../interfaces/ObservationStore.md).[`close`](../interfaces/ObservationStore.md#close)

***

### count()

> **count**(): `Promise`\<`number`\>

#### Returns

`Promise`\<`number`\>

#### Implementation of

[`ObservationStore`](../interfaces/ObservationStore.md).[`count`](../interfaces/ObservationStore.md#count)

***

### head()

> **head**(): `Promise`\<`number`\>

#### Returns

`Promise`\<`number`\>

#### Implementation of

[`ObservationStore`](../interfaces/ObservationStore.md).[`head`](../interfaces/ObservationStore.md#head)

***

### readSince()

> **readSince**(): `Promise`\<[`OmniaObservation`](../interfaces/OmniaObservation.md)[]\>

#### Returns

`Promise`\<[`OmniaObservation`](../interfaces/OmniaObservation.md)[]\>

#### Implementation of

[`ObservationStore`](../interfaces/ObservationStore.md).[`readSince`](../interfaces/ObservationStore.md#readsince)

***

### tail()

> **tail**(): `Promise`\<[`OmniaObservation`](../interfaces/OmniaObservation.md)[]\>

#### Returns

`Promise`\<[`OmniaObservation`](../interfaces/OmniaObservation.md)[]\>

#### Implementation of

[`ObservationStore`](../interfaces/ObservationStore.md).[`tail`](../interfaces/ObservationStore.md#tail)
