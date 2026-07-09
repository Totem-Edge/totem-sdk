[**@totemsdk/root-identity**](../index.md)

***

[@totemsdk/root-identity](../index.md) / WotsProof

# Interface: WotsProof

A single WOTS signing proof tied to an on-chain address.

Both `signature` and `publicKey` are lower-case hex strings (no 0x prefix).
`message` is the exact UTF-8 string that was signed so callers can
reconstruct the SHA3-256 digest independently.

## Properties

### address

> **address**: `string`

***

### message

> **message**: `string`

***

### publicKey

> **publicKey**: `string`

***

### signature

> **signature**: `string`
