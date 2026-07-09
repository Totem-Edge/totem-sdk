[**@totemsdk/omnia-vtxo**](../index.md)

***

[@totemsdk/omnia-vtxo](../index.md) / mintVtxo

# Function: mintVtxo()

> **mintVtxo**(`pool`, `params`, `now?`): [`MintResult`](../interfaces/MintResult.md)

Mints a new VTXO against a pool.

## Parameters

### pool

[`OmniaVtxoPool`](../interfaces/OmniaVtxoPool.md)

The pool to mint from.

### params

[`MintVtxoParams`](../interfaces/MintVtxoParams.md)

Mint parameters (owner, amount, nonce).

### now?

`number`

Timestamp in ms. Defaults to Date.now() if omitted — pass explicitly for determinism.

## Returns

[`MintResult`](../interfaces/MintResult.md)
