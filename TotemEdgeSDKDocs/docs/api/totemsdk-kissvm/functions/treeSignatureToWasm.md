[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / treeSignatureToWasm

# Function: treeSignatureToWasm()

> **treeSignatureToWasm**(`sig`): `unknown`

Convert a canonical Minima `TreeSignature` into the shape the Rust VM's
serde bridge deserializes (`totemsdk_core_wasm::treekey::TreeSignature`).
Byte fields become plain number arrays; `mmrProof.blockTime` is dropped (the
Rust proof has no block time and serde ignores unknown fields).

## Parameters

### sig

`TreeSignature`

## Returns

`unknown`
