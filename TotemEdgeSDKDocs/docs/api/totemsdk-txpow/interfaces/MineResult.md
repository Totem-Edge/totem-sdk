[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / MineResult

# Interface: MineResult

## Properties

### elapsedMs

> **elapsedMs**: `number`

***

### minedHeaderBytes

> **minedHeaderBytes**: `Uint8Array`

Fully serialized TxHeader bytes with the winning nonce.

***

### nonce

> **nonce**: `bigint`

***

### source

> **source**: `"wasm"` \| `"js"`

'wasm' when the WASM binary is present; 'js' otherwise.

***

### txpowId

> **txpowId**: `Uint8Array`

SHA3-256(minedHeaderBytes) — the canonical TxPoW ID.
