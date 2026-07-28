[**@totemsdk/edge-lorawan**](../index.md)

***

[@totemsdk/edge-lorawan](../index.md) / LorawanGateway

# Interface: LorawanGateway

## Properties

### status

> `readonly` **status**: `"stopped"` \| `"running"` \| `"error"`

## Methods

### sendConfirmed()

> **sendConfirmed**(`port`, `data`): `Promise`\<`void`\>

Send a confirmed uplink.

#### Parameters

##### port

`number`

##### data

`Uint8Array`

#### Returns

`Promise`\<`void`\>

***

### sendUnconfirmed()

> **sendUnconfirmed**(`port`, `data`): `Promise`\<`void`\>

Send an unconfirmed uplink.

#### Parameters

##### port

`number`

##### data

`Uint8Array`

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
