[**@totemsdk/replication**](../index.md)

***

[@totemsdk/replication](../index.md) / ReplicatedReadOptions

# Interface: ReplicatedReadOptions\<T\>

## Type Parameters

### T

`T`

## Properties

### maxAgeMs?

> `readonly` `optional` **maxAgeMs?**: `number`

***

### now?

> `readonly` `optional` **now?**: () => `number`

#### Returns

`number`

***

### readPrimary?

> `readonly` `optional` **readPrimary?**: (`key`) => `Promise`\<`T` \| `null`\>

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`T` \| `null`\>

***

### readReplica

> `readonly` **readReplica**: (`key`) => `Promise`\<[`ReplicaObservation`](ReplicaObservation.md)\<`T`\> \| `null`\>

#### Parameters

##### key

`string`

#### Returns

`Promise`\<[`ReplicaObservation`](ReplicaObservation.md)\<`T`\> \| `null`\>
