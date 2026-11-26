[**@totemsdk/replication-holepunch**](../index.md)

***

[@totemsdk/replication-holepunch](../index.md) / HypercoreLogOptions

# Interface: HypercoreLogOptions

## Properties

### descriptor

> **descriptor**: `DatasetDescriptor`

***

### Hypercore?

> `optional` **Hypercore?**: (`path`, `key?`) => `any`

Inject a Hypercore constructor (tests) instead of importing it.

#### Parameters

##### path

`string`

##### key?

`Buffer`\<`ArrayBufferLike`\>

#### Returns

`any`

***

### key?

> `optional` **key?**: `Buffer`\<`ArrayBufferLike`\>

Optional root key for a read replica.

***

### storagePath

> **storagePath**: `string`
