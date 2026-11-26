[**@totemsdk/replication**](../index.md)

***

[@totemsdk/replication](../index.md) / DistributedFileStore

# Interface: DistributedFileStore

## Methods

### close()

> **close**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### get()

> **get**(`path`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\> \| `null`\>

#### Parameters

##### path

`string`

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\> \| `null`\>

***

### put()

> **put**(`path`, `data`): `Promise`\<`void`\>

#### Parameters

##### path

`string`

##### data

`Uint8Array`

#### Returns

`Promise`\<`void`\>

***

### status()

> **status**(): [`ReplicationStatus`](ReplicationStatus.md)

#### Returns

[`ReplicationStatus`](ReplicationStatus.md)
