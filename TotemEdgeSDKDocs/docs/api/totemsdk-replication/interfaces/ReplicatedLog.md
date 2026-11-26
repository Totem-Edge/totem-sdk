[**@totemsdk/replication**](../index.md)

***

[@totemsdk/replication](../index.md) / ReplicatedLog

# Interface: ReplicatedLog\<T\>

## Type Parameters

### T

`T`

## Methods

### append()

> **append**(`record`): `Promise`\<\{ `head`: `string`; `length`: `number`; \}\>

#### Parameters

##### record

`T`

#### Returns

`Promise`\<\{ `head`: `string`; `length`: `number`; \}\>

***

### close()

> **close**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### readSince()

> **readSince**(`cursor?`): `AsyncIterable`\<\{ `cursor`: `string`; `record`: `T`; \}\>

#### Parameters

##### cursor?

`string`

#### Returns

`AsyncIterable`\<\{ `cursor`: `string`; `record`: `T`; \}\>

***

### status()

> **status**(): [`ReplicationStatus`](ReplicationStatus.md)

#### Returns

[`ReplicationStatus`](ReplicationStatus.md)
