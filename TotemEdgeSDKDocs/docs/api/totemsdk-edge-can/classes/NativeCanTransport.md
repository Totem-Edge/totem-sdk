[**@totemsdk/edge-can**](../index.md)

***

[@totemsdk/edge-can](../index.md) / NativeCanTransport

# Class: NativeCanTransport

CAN bus transport port — injected by the caller.

Supports socketcan (Linux), PCAN, or any CAN interface.
Frames use 11-bit or 29-bit arbitration IDs.

## Implements

- [`CanTransportPort`](../interfaces/CanTransportPort.md)

## Constructors

### Constructor

> **new NativeCanTransport**(`config?`): `NativeCanTransport`

#### Parameters

##### config?

[`NativeCanConfig`](../interfaces/NativeCanConfig.md) = `{}`

#### Returns

`NativeCanTransport`

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Close the CAN interface.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`CanTransportPort`](../interfaces/CanTransportPort.md).[`close`](../interfaces/CanTransportPort.md#close)

***

### onError()

> **onError**(`handler`): () => `void`

Register a handler for interface errors.

#### Parameters

##### handler

(`err`) => `void`

#### Returns

() => `void`

#### Implementation of

[`CanTransportPort`](../interfaces/CanTransportPort.md).[`onError`](../interfaces/CanTransportPort.md#onerror)

***

### onFrame()

> **onFrame**(`handler`): () => `void`

Register a handler for received CAN frames.

#### Parameters

##### handler

(`frame`) => `void`

#### Returns

() => `void`

#### Implementation of

[`CanTransportPort`](../interfaces/CanTransportPort.md).[`onFrame`](../interfaces/CanTransportPort.md#onframe)

***

### open()

> **open**(`interfaceName`): `Promise`\<`void`\>

Open the CAN interface.

#### Parameters

##### interfaceName

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`CanTransportPort`](../interfaces/CanTransportPort.md).[`open`](../interfaces/CanTransportPort.md#open)

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

#### Implementation of

[`CanTransportPort`](../interfaces/CanTransportPort.md).[`send`](../interfaces/CanTransportPort.md#send)
