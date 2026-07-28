[**@totemsdk/edge-coap**](../index.md)

***

[@totemsdk/edge-coap](../index.md) / NativeCoapTransport

# Class: NativeCoapTransport

CoAP transport port — injected by the caller.

CoAP (RFC 7252) runs over UDP. The caller provides the socket.
Messages are confirmable (CON), non-confirmable (NON),
acknowledgement (ACK), or reset (RST).

## Implements

- [`CoapTransportPort`](../interfaces/CoapTransportPort.md)

## Constructors

### Constructor

> **new NativeCoapTransport**(`config?`): `NativeCoapTransport`

#### Parameters

##### config?

[`NativeCoapConfig`](../interfaces/NativeCoapConfig.md) = `{}`

#### Returns

`NativeCoapTransport`

## Methods

### bind()

> **bind**(`_port`): `Promise`\<`void`\>

Bind to a local port.

#### Parameters

##### \_port

`number`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`CoapTransportPort`](../interfaces/CoapTransportPort.md).[`bind`](../interfaces/CoapTransportPort.md#bind)

***

### close()

> **close**(): `Promise`\<`void`\>

Close the socket.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`CoapTransportPort`](../interfaces/CoapTransportPort.md).[`close`](../interfaces/CoapTransportPort.md#close)

***

### onError()

> **onError**(`handler`): () => `void`

Register a handler for socket errors.

#### Parameters

##### handler

(`err`) => `void`

#### Returns

() => `void`

#### Implementation of

[`CoapTransportPort`](../interfaces/CoapTransportPort.md).[`onError`](../interfaces/CoapTransportPort.md#onerror)

***

### onMessage()

> **onMessage**(`handler`): () => `void`

Register a handler for inbound CoAP messages.

#### Parameters

##### handler

(`message`, `remote`) => `void`

#### Returns

() => `void`

#### Implementation of

[`CoapTransportPort`](../interfaces/CoapTransportPort.md).[`onMessage`](../interfaces/CoapTransportPort.md#onmessage)

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

#### Implementation of

[`CoapTransportPort`](../interfaces/CoapTransportPort.md).[`send`](../interfaces/CoapTransportPort.md#send)
