[**@totemsdk/edge-coap**](../index.md)

***

[@totemsdk/edge-coap](../index.md) / CoapResponseData

# Interface: CoapResponseData

## Extended by

- [`CoapObservationData`](CoapObservationData.md)

## Properties

### block1?

> `optional` **block1?**: [`CoapBlockOption`](CoapBlockOption.md)

Block1 option echoed by the server.

***

### block2?

> `optional` **block2?**: [`CoapBlockOption`](CoapBlockOption.md)

Block2 option describing this response block.

***

### contentFormat?

> `optional` **contentFormat?**: `number`

Content-Format option value, e.g. 0 text/plain or 60 application/cbor.

***

### observe?

> `optional` **observe?**: `number`

Observe option value (notifications only).

***

### payload

> **payload**: `Uint8Array`

***

### size1?

> `optional` **size1?**: `number`

Size1 hint from the server.

***

### size2?

> `optional` **size2?**: `number`

Size2 hint (total response body size).
