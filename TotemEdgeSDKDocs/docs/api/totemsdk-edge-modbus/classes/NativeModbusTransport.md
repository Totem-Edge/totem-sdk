[**@totemsdk/edge-modbus**](../index.md)

***

[@totemsdk/edge-modbus](../index.md) / NativeModbusTransport

# Class: NativeModbusTransport

Modbus transport port — injected by the caller.

Supports Modbus TCP (port 502) and Modbus RTU (serial).
The caller provides the actual socket/serial implementation.

## Implements

- [`ModbusTransportPort`](../interfaces/ModbusTransportPort.md)

## Constructors

### Constructor

> **new NativeModbusTransport**(`config?`): `NativeModbusTransport`

#### Parameters

##### config?

[`NativeModbusConfig`](../interfaces/NativeModbusConfig.md) = `{}`

#### Returns

`NativeModbusTransport`

## Methods

### connect()

> **connect**(): `Promise`\<`void`\>

Open the connection.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`ModbusTransportPort`](../interfaces/ModbusTransportPort.md).[`connect`](../interfaces/ModbusTransportPort.md#connect)

***

### disconnect()

> **disconnect**(): `Promise`\<`void`\>

Close the connection.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`ModbusTransportPort`](../interfaces/ModbusTransportPort.md).[`disconnect`](../interfaces/ModbusTransportPort.md#disconnect)

***

### onError()

> **onError**(`handler`): () => `void`

Register a handler for connection errors.

#### Parameters

##### handler

(`err`) => `void`

#### Returns

() => `void`

#### Implementation of

[`ModbusTransportPort`](../interfaces/ModbusTransportPort.md).[`onError`](../interfaces/ModbusTransportPort.md#onerror)

***

### onFrame()

> **onFrame**(`handler`): () => `void`

Register a handler for unsolicited/inbound frames.

#### Parameters

##### handler

(`frame`) => `void`

#### Returns

() => `void`

#### Implementation of

[`ModbusTransportPort`](../interfaces/ModbusTransportPort.md).[`onFrame`](../interfaces/ModbusTransportPort.md#onframe)

***

### sendFrame()

> **sendFrame**(`frame`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Send a raw Modbus frame and receive the response.

#### Parameters

##### frame

`Uint8Array`

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

#### Implementation of

[`ModbusTransportPort`](../interfaces/ModbusTransportPort.md).[`sendFrame`](../interfaces/ModbusTransportPort.md#sendframe)
