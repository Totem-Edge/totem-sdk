[**@totemsdk/edge-coap**](../index.md)

***

[@totemsdk/edge-coap](../index.md) / CoapSecurityPort

# Interface: CoapSecurityPort

## Methods

### protect()

> **protect**(`message`): `Promise`\<[`CoapMessage`](CoapMessage.md)\>

Add OSCORE protection. The implementation may replace `payload`, add the
OSCORE option and must preserve `messageId` and `token`.

#### Parameters

##### message

[`CoapMessage`](CoapMessage.md)

#### Returns

`Promise`\<[`CoapMessage`](CoapMessage.md)\>

***

### protects()

> **protects**(`host`, `port`): `boolean`

Whether outbound traffic to (and inbound traffic from) this endpoint must be protected.

#### Parameters

##### host

`string`

##### port

`number`

#### Returns

`boolean`

***

### unprotect()

> **unprotect**(`message`): `Promise`\<[`CoapMessage`](CoapMessage.md)\>

Authenticate and decrypt an inbound OSCORE message. Must throw on replay,
authentication failure or an unknown context; the gateway drops the message.

#### Parameters

##### message

[`CoapMessage`](CoapMessage.md)

#### Returns

`Promise`\<[`CoapMessage`](CoapMessage.md)\>
