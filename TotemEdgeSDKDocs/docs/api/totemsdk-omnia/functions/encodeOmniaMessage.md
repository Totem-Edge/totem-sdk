[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / encodeOmniaMessage

# Function: encodeOmniaMessage()

> **encodeOmniaMessage**(`msg`): `Uint8Array`

Encode an OmniaMessage to a length-prefixed frame.

Sentinel encoding rules (applied recursively via JSON replacer):
  - `bigint`     → `{ __bigint: "<decimal string>" }`
  - `Uint8Array` → `{ __uint8array: "<hex string>" }`

## Parameters

### msg

[`OmniaMessage`](../interfaces/OmniaMessage.md)

## Returns

`Uint8Array`
