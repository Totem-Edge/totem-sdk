[**@totemsdk/edge-coap**](../index.md)

***

[@totemsdk/edge-coap](../index.md) / OscoreContextConfig

# Interface: OscoreContextConfig

## Properties

### endpoints?

> `optional` **endpoints?**: `object`[]

Restrict protection to these endpoints. Default: all endpoints.

#### host

> **host**: `string`

#### port

> **port**: `number`

***

### idContext?

> `optional` **idContext?**: `Uint8Array`\<`ArrayBufferLike`\>

***

### masterSalt?

> `optional` **masterSalt?**: `Uint8Array`\<`ArrayBufferLike`\>

Optional master salt; defaults to the empty byte string.

***

### masterSecret

> **masterSecret**: `Uint8Array`

***

### recipientId

> **recipientId**: `Uint8Array`

***

### replayWindowSize?

> `optional` **replayWindowSize?**: `number`

Anti-replay window for inbound Partial IVs. Default 32.

***

### senderId

> **senderId**: `Uint8Array`

***

### senderSequenceNumber?

> `optional` **senderSequenceNumber?**: `number`

Initial sender sequence number (Partial IV). Default 0.
