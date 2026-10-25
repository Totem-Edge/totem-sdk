[**@totemsdk/p2p-hub**](../index.md)

***

[@totemsdk/p2p-hub](../index.md) / HubClient

# Interface: HubClient

## Properties

### id

> `readonly` **id**: `string`

***

### origin?

> `readonly` `optional` **origin?**: `string`

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

### onFrame()

> **onFrame**(`handler`): () => `void`

#### Parameters

##### handler

(`frame`) => `void`

#### Returns

() => `void`

***

### send()

> **send**(`frame`): `void`

#### Parameters

##### frame

`HubServerFrame`

#### Returns

`void`
