[**@totemsdk/edge-coap**](../index.md)

***

[@totemsdk/edge-coap](../index.md) / CborValue

# Type Alias: CborValue

> **CborValue** = `null` \| `undefined` \| `boolean` \| `number` \| `bigint` \| `string` \| `Uint8Array` \| `CborValue`[] \| \{\[`key`: `string`\]: `CborValue`; \} \| `Map`\<`CborValue`, `CborValue`\>

Minimal CBOR (RFC 8949) decoder for constrained-device payloads.

Supports the deterministic core used by sensors: unsigned/negative
integers, byte/text strings, arrays, maps, tags (unwrapped), booleans, null,
undefined, half/single/double floats and indefinite-length containers.
Maps with all-text keys decode to plain objects; other maps decode to `Map`.

This is a decoder, not a general CBOR library: it does not expose tag
semantics and rejects malformed, truncated, duplicate-key or over-deep input.
