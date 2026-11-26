[**@totemsdk/replication-holepunch**](../index.md)

***

[@totemsdk/replication-holepunch](../index.md) / HyperbeeDistributedIndex

# Class: HyperbeeDistributedIndex

## Implements

- `DistributedIndex`

## Accessors

### raw

#### Get Signature

> **get** **raw**(): `any`

##### Returns

`any`

## Methods

### close()

> **close**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

#### Implementation of

`DistributedIndex.close`

***

### get()

> **get**(`key`): `Promise`\<`unknown`\>

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`unknown`\>

#### Implementation of

`DistributedIndex.get`

***

### list()

> **list**(`prefix?`): `AsyncIterable`\<\{ `key`: `string`; `value`: `unknown`; \}\>

#### Parameters

##### prefix?

`string` = `''`

#### Returns

`AsyncIterable`\<\{ `key`: `string`; `value`: `unknown`; \}\>

#### Implementation of

`DistributedIndex.list`

***

### put()

> **put**(`key`, `value`): `Promise`\<`void`\>

Producer-side write (the read contract does not expose it).

#### Parameters

##### key

`string`

##### value

`unknown`

#### Returns

`Promise`\<`void`\>

***

### status()

> **status**(): `ReplicationStatus`

#### Returns

`ReplicationStatus`

#### Implementation of

`DistributedIndex.status`

***

### open()

> `static` **open**(`options`): `Promise`\<`HyperbeeDistributedIndex`\>

#### Parameters

##### options

[`HyperbeeIndexOptions`](../interfaces/HyperbeeIndexOptions.md)

#### Returns

`Promise`\<`HyperbeeDistributedIndex`\>
