[**@totemsdk/edge-can**](../index.md)

***

[@totemsdk/edge-can](../index.md) / CanGateway

# Interface: CanGateway

## Properties

### status

> `readonly` **status**: `"stopped"` \| `"running"` \| `"error"`

## Methods

### send()

> **send**(`id`, `data`, `isExtended?`): `Promise`\<`void`\>

#### Parameters

##### id

`number`

##### data

`Uint8Array`

##### isExtended?

`boolean`

#### Returns

`Promise`\<`void`\>

***

### start()

> **start**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### stop()

> **stop**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>
