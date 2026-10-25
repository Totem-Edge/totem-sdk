[**@totemsdk/p2p-hub**](../index.md)

***

[@totemsdk/p2p-hub](../index.md) / HubNetworkConnection

# Interface: HubNetworkConnection

## Properties

### remoteId?

> `readonly` `optional` **remoteId?**: `string`

## Methods

### close()

> **close**(): `void`

#### Returns

`void`

***

### onClose()

> **onClose**(`handler`): () => `void`

#### Parameters

##### handler

() => `void`

#### Returns

() => `void`

***

### onData()

> **onData**(`handler`): () => `void`

#### Parameters

##### handler

(`data`) => `void`

#### Returns

() => `void`

***

### send()

> **send**(`data`): `void` \| `Promise`\<`void`\>

#### Parameters

##### data

`Uint8Array`

#### Returns

`void` \| `Promise`\<`void`\>
