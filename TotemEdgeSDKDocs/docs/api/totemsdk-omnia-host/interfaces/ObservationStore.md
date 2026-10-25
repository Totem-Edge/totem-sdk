[**@totemsdk/omnia-host**](../index.md)

***

[@totemsdk/omnia-host](../index.md) / ObservationStore

# Interface: ObservationStore

## Methods

### append()

> **append**(`record`): `Promise`\<\{ `createdAt`: `number`; `seq`: `number`; \}\>

#### Parameters

##### record

[`ObservationRecord`](../type-aliases/ObservationRecord.md)

#### Returns

`Promise`\<\{ `createdAt`: `number`; `seq`: `number`; \}\>

***

### close()

> **close**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### count()

> **count**(): `Promise`\<`number`\>

#### Returns

`Promise`\<`number`\>

***

### head()

> **head**(): `Promise`\<`number`\>

#### Returns

`Promise`\<`number`\>

***

### readSince()

> **readSince**(`seq`): `Promise`\<[`OmniaObservation`](OmniaObservation.md)[]\>

#### Parameters

##### seq

`number`

#### Returns

`Promise`\<[`OmniaObservation`](OmniaObservation.md)[]\>

***

### tail()

> **tail**(`count`): `Promise`\<[`OmniaObservation`](OmniaObservation.md)[]\>

#### Parameters

##### count

`number`

#### Returns

`Promise`\<[`OmniaObservation`](OmniaObservation.md)[]\>
