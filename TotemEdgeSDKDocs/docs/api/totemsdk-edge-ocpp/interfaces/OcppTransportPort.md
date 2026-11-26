[**@totemsdk/edge-ocpp**](../index.md)

***

[@totemsdk/edge-ocpp](../index.md) / OcppTransportPort

# Interface: OcppTransportPort

OCPP transport port — injected by the caller.

The caller supplies a WebSocket (or test) transport that carries OCPP-J text
frames. The connector owns framing, correlation, CALL handling, heartbeats
and proof shaping.

## Properties

### state?

> `readonly` `optional` **state?**: `"closed"` \| `"connecting"` \| `"open"`

## Methods

### close()

> **close**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### connect()

> **connect**(`url`, `protocols?`): `Promise`\<`void`\>

#### Parameters

##### url

`string`

##### protocols?

`string`[]

#### Returns

`Promise`\<`void`\>

***

### onClose()

> **onClose**(`handler`): () => `void`

#### Parameters

##### handler

() => `void`

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

### onMessage()

> **onMessage**(`handler`): () => `void`

#### Parameters

##### handler

(`message`) => `void`

#### Returns

() => `void`

***

### send()

> **send**(`message`): `Promise`\<`void`\>

#### Parameters

##### message

`string`

#### Returns

`Promise`\<`void`\>
