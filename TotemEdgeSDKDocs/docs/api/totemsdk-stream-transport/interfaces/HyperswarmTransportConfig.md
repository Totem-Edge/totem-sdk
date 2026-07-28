[**@totemsdk/stream-transport**](../index.md)

***

[@totemsdk/stream-transport](../index.md) / HyperswarmTransportConfig

# Interface: HyperswarmTransportConfig

## Properties

### joinOpts?

> `optional` **joinOpts?**: `object`

Hyperswarm join options. Default: { server: true, client: true }.

#### client?

> `optional` **client?**: `boolean`

#### server?

> `optional` **server?**: `boolean`

***

### targetPublicKey?

> `optional` **targetPublicKey?**: `any`

Optional: only accept connections matching this 32-byte pubkey.

***

### topic

> **topic**: `Buffer`

32-byte topic buffer to join.
