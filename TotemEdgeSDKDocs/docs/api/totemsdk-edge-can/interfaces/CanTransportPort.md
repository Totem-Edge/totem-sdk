[**@totemsdk/edge-can**](../index.md)

***

[@totemsdk/edge-can](../index.md) / CanTransportPort

# Interface: CanTransportPort

CAN bus transport port — injected by the caller.

Supports socketcan (Linux), PCAN, or any CAN interface.
Frames use 11-bit or 29-bit arbitration IDs.

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Close the CAN interface.

#### Returns

`Promise`\<`void`\>

***

### onError()

> **onError**(`handler`): () => `void`

Register a handler for interface errors.

#### Parameters

##### handler

(`err`) => `void`

#### Returns

() => `void`

***

### onFrame()

> **onFrame**(`handler`): () => `void`

Register a handler for received CAN frames.

#### Parameters

##### handler

(`frame`) => `void`

#### Returns

() => `void`

***

### open()

> **open**(`interfaceName`): `Promise`\<`void`\>

Open the CAN interface.

#### Parameters

##### interfaceName

`string`

#### Returns

`Promise`\<`void`\>

***

### send()

> **send**(`id`, `data`, `isExtended`): `Promise`\<`void`\>

Send a CAN frame.

#### Parameters

##### id

`number`

##### data

`Uint8Array`

##### isExtended

`boolean`

#### Returns

`Promise`\<`void`\>
