[**@totemsdk/edge-coap**](../index.md)

***

[@totemsdk/edge-coap](../index.md) / CoapTransportPort

# Interface: CoapTransportPort

CoAP transport port — injected by the caller.

CoAP (RFC 7252) runs over UDP. The caller provides the socket.
Messages are confirmable (CON), non-confirmable (NON),
acknowledgement (ACK), or reset (RST).

## Methods

### bind()

> **bind**(`port`): `Promise`\<`void`\>

Bind to a local port.

#### Parameters

##### port

`number`

#### Returns

`Promise`\<`void`\>

***

### close()

> **close**(): `Promise`\<`void`\>

Close the socket.

#### Returns

`Promise`\<`void`\>

***

### onError()

> **onError**(`handler`): () => `void`

Register a handler for socket errors.

#### Parameters

##### handler

(`err`) => `void`

#### Returns

() => `void`

***

### onMessage()

> **onMessage**(`handler`): () => `void`

Register a handler for inbound CoAP messages.

#### Parameters

##### handler

(`message`, `remote`) => `void`

#### Returns

() => `void`

***

### send()

> **send**(`host`, `port`, `message`): `Promise`\<`void`\>

Send a CoAP message to a remote endpoint.

#### Parameters

##### host

`string`

##### port

`number`

##### message

`Uint8Array`

#### Returns

`Promise`\<`void`\>
