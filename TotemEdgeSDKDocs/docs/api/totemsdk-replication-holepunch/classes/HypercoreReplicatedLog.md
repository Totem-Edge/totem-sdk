[**@totemsdk/replication-holepunch**](../index.md)

***

[@totemsdk/replication-holepunch](../index.md) / HypercoreReplicatedLog

# Class: HypercoreReplicatedLog\<T\>

## Type Parameters

### T

`T`

## Implements

- `ReplicatedLog`\<`T`\>

## Accessors

### raw

#### Get Signature

> **get** **raw**(): `any`

Raw Hypercore for replication plumbing/tests.

##### Returns

`any`

## Methods

### append()

> **append**(`record`): `Promise`\<\{ `head`: `string`; `length`: `number`; \}\>

#### Parameters

##### record

`T`

#### Returns

`Promise`\<\{ `head`: `string`; `length`: `number`; \}\>

#### Implementation of

`ReplicatedLog.append`

***

### close()

> **close**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

#### Implementation of

`ReplicatedLog.close`

***

### readSince()

> **readSince**(`cursor?`): `AsyncIterable`\<\{ `cursor`: `string`; `record`: `T`; \}\>

#### Parameters

##### cursor?

`string`

#### Returns

`AsyncIterable`\<\{ `cursor`: `string`; `record`: `T`; \}\>

#### Implementation of

`ReplicatedLog.readSince`

***

### status()

> **status**(): `ReplicationStatus`

#### Returns

`ReplicationStatus`

#### Implementation of

`ReplicatedLog.status`

***

### open()

> `static` **open**\<`T`\>(`options`): `Promise`\<`HypercoreReplicatedLog`\<`T`\>\>

#### Type Parameters

##### T

`T`

#### Parameters

##### options

[`HypercoreLogOptions`](../interfaces/HypercoreLogOptions.md)

#### Returns

`Promise`\<`HypercoreReplicatedLog`\<`T`\>\>
