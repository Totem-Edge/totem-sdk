[**@totemsdk/replication**](../index.md)

***

[@totemsdk/replication](../index.md) / DistributedIndex

# Interface: DistributedIndex

## Methods

### close()

> **close**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### get()

> **get**(`key`): `Promise`\<`unknown`\>

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`unknown`\>

***

### list()

> **list**(`prefix?`): `AsyncIterable`\<\{ `key`: `string`; `value`: `unknown`; \}\>

#### Parameters

##### prefix?

`string`

#### Returns

`AsyncIterable`\<\{ `key`: `string`; `value`: `unknown`; \}\>

***

### status()

> **status**(): [`ReplicationStatus`](ReplicationStatus.md)

#### Returns

[`ReplicationStatus`](ReplicationStatus.md)
