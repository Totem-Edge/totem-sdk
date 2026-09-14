[**@totemsdk/chain-provider**](../index.md)

***

[@totemsdk/chain-provider](../index.md) / verifyDepositMmrProof

# Function: verifyDepositMmrProof()

> **verifyDepositMmrProof**(`leafPubkey`, `proof`, `expectedRoot`): `boolean`

Offline verification of a legacy chunk MMR proof against an expected root.
Pure function — a peer holding (leafPubkey, proof, root) can re-validate a
deposit commitment without node access. The proof is encoded to the wasm
contract (hex `data`, decimal-string `value` per chunk).

## Parameters

### leafPubkey

`Uint8Array`

### proof

[`MmrChunkProof`](../interfaces/MmrChunkProof.md)

### expectedRoot

`Uint8Array`

## Returns

`boolean`
