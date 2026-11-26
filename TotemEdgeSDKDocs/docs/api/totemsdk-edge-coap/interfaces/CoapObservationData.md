[**@totemsdk/edge-coap**](../index.md)

***

[@totemsdk/edge-coap](../index.md) / CoapObservationData

# Interface: CoapObservationData

## Extends

- [`CoapResponseData`](CoapResponseData.md)

## Properties

### block1?

> `optional` **block1?**: [`CoapBlockOption`](CoapBlockOption.md)

Block1 option echoed by the server.

#### Inherited from

[`CoapResponseData`](CoapResponseData.md).[`block1`](CoapResponseData.md#block1)

***

### block2?

> `optional` **block2?**: [`CoapBlockOption`](CoapBlockOption.md)

Block2 option describing this response block.

#### Inherited from

[`CoapResponseData`](CoapResponseData.md).[`block2`](CoapResponseData.md#block2)

***

### contentFormat?

> `optional` **contentFormat?**: `number`

Content-Format option value, e.g. 0 text/plain or 60 application/cbor.

#### Inherited from

[`CoapResponseData`](CoapResponseData.md).[`contentFormat`](CoapResponseData.md#contentformat)

***

### observe

> **observe**: `number`

Observe option value (notifications only).

#### Overrides

[`CoapResponseData`](CoapResponseData.md).[`observe`](CoapResponseData.md#observe)

***

### payload

> **payload**: `Uint8Array`

#### Inherited from

[`CoapResponseData`](CoapResponseData.md).[`payload`](CoapResponseData.md#payload)

***

### receivedAt

> **receivedAt**: `number`

***

### size1?

> `optional` **size1?**: `number`

Size1 hint from the server.

#### Inherited from

[`CoapResponseData`](CoapResponseData.md).[`size1`](CoapResponseData.md#size1)

***

### size2?

> `optional` **size2?**: `number`

Size2 hint (total response body size).

#### Inherited from

[`CoapResponseData`](CoapResponseData.md).[`size2`](CoapResponseData.md#size2)
