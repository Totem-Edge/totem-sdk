[**@totemsdk/edge-modbus**](../index.md)

***

[@totemsdk/edge-modbus](../index.md) / ModbusTransportPort

# Interface: ModbusTransportPort

Modbus transport port — injected by the caller.

Supports Modbus TCP (port 502) and Modbus RTU (serial).
The caller provides the actual socket/serial implementation.

## Methods

### connect()

> **connect**(): `Promise`\<`void`\>

Open the connection.

#### Returns

`Promise`\<`void`\>

***

### disconnect()

> **disconnect**(): `Promise`\<`void`\>

Close the connection.

#### Returns

`Promise`\<`void`\>

***

### onError()

> **onError**(`handler`): () => `void`

Register a handler for connection errors.

#### Parameters

##### handler

(`err`) => `void`

#### Returns

() => `void`

***

### onFrame()

> **onFrame**(`handler`): () => `void`

Register a handler for unsolicited/inbound frames.

#### Parameters

##### handler

(`frame`) => `void`

#### Returns

() => `void`

***

### sendFrame()

> **sendFrame**(`frame`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Send a raw Modbus frame and receive the response.

#### Parameters

##### frame

`Uint8Array`

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>
