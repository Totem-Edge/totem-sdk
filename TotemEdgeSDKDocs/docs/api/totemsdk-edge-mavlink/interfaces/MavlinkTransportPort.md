[**@totemsdk/edge-mavlink**](../index.md)

***

[@totemsdk/edge-mavlink](../index.md) / MavlinkTransportPort

# Interface: MavlinkTransportPort

MAVLink transport port — injected by the caller.

The caller supplies the byte pipe (serial, UDP, TCP, WebSocket or a test
simulator). The connector owns MAVLink 1/2 framing, CRC, message decoding,
heartbeat, command correlation and proof shaping.

## Methods

### onData()

> **onData**(`handler`): () => `void`

#### Parameters

##### handler

(`bytes`) => `void`

#### Returns

() => `void`

***

### onError()

> **onError**(`handler`): () => `void`

#### Parameters

##### handler

(`err`) => `void`

#### Returns

() => `void`

***

### send()

> **send**(`bytes`): `Promise`\<`void`\>

#### Parameters

##### bytes

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
