[**@totemsdk/server**](../index.md)

***

[@totemsdk/server](../index.md) / bytesToHex

# Function: bytesToHex()

> **bytesToHex**(`bytes`): `string`

Wasm-free byte utilities (RFC-031 Fix A).

Byte-exact equivalents of the WASM kernels `bytes_to_hex` (uppercase, via
`hex::encode_upper`), `hex_to_bytes` (strips a leading lowercase `0x`),
and `concat_bytes`. Living outside `wasm-sync` lets pure consumers and the
core root avoid loading the WASM artifact for hex/concat work.

## Parameters

### bytes

`Uint8Array`

## Returns

`string`
