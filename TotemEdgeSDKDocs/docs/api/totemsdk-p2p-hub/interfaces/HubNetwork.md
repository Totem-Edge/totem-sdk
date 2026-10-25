[**@totemsdk/p2p-hub**](../index.md)

***

[@totemsdk/p2p-hub](../index.md) / HubNetwork

# Interface: HubNetwork

## Methods

### close()?

> `optional` **close**(): `void` \| `Promise`\<`void`\>

#### Returns

`void` \| `Promise`\<`void`\>

***

### join()

> **join**(`topic`): `void` \| `Promise`\<`void`\>

#### Parameters

##### topic

`Uint8Array`

#### Returns

`void` \| `Promise`\<`void`\>

***

### leave()

> **leave**(`topic`): `void` \| `Promise`\<`void`\>

#### Parameters

##### topic

`Uint8Array`

#### Returns

`void` \| `Promise`\<`void`\>

***

### onConnection()

> **onConnection**(`handler`): () => `void`

#### Parameters

##### handler

(`connection`, `topicHexes`) => `void`

#### Returns

() => `void`
