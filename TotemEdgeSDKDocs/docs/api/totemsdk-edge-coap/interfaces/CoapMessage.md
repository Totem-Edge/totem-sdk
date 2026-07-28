[**@totemsdk/edge-coap**](../index.md)

***

[@totemsdk/edge-coap](../index.md) / CoapMessage

# Interface: CoapMessage

## Properties

### messageId

> **messageId**: `number`

Message ID for deduplication.

***

### method?

> `optional` **method?**: [`CoapMethod`](../type-aliases/CoapMethod.md)

Request method (only for CON/NON requests).

***

### path

> **path**: `string`[]

URI path (e.g. ["sensors", "temperature"]).

***

### payload

> **payload**: `Uint8Array`

Payload bytes.

***

### receivedAt

> **receivedAt**: `number`

Timestamp of receipt.

***

### remote

> **remote**: `object`

Remote endpoint.

#### host

> **host**: `string`

#### port

> **port**: `number`

***

### responseCode?

> `optional` **responseCode?**: `string`

Response code (only for ACK responses).

***

### token

> **token**: `Uint8Array`

Token for request/response matching.

***

### type

> **type**: [`CoapMessageType`](../type-aliases/CoapMessageType.md)

Message type.
