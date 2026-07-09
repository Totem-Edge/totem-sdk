[**@totemsdk/omnia-hyperswarm**](../index.md)

***

[@totemsdk/omnia-hyperswarm](../index.md) / encodeOmniaMessage

# Function: encodeOmniaMessage()

> **encodeOmniaMessage**(`msg`): `Uint8Array`

Encode an OmniaMessage to a length-prefixed frame.

Sentinel encoding rules (applied recursively via JSON replacer):
  - `bigint`     → `{ __bigint: "<decimal string>" }`
  - `Uint8Array` → `{ __uint8array: "<hex string>" }`

Both sentinels are lossless and do not collide with each other or with plain
object keys. The wire format (4-byte BE uint32 length prefix + UTF-8 JSON)
is byte-compatible with @totemsdk/lookup-protocol framing.

## Parameters

### msg

[`OmniaMessage`](../interfaces/OmniaMessage.md)

## Returns

`Uint8Array`
