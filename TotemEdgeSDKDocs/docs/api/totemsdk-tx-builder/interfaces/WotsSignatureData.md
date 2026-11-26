[**@totemsdk/tx-builder**](../index.md)

***

[@totemsdk/tx-builder](../index.md) / WotsSignatureData

# Interface: WotsSignatureData

Hierarchical per-address TreeKey signature data.

`proofs` is the Root→L1→L2→DATA chain; each `mmrProof` is already serialized
in the Minima MMR proof wire format (the extension returns it that way).

## Properties

### addressIndex?

> `optional` **addressIndex?**: `number`

***

### hierarchical

> **hierarchical**: `boolean`

***

### l1?

> `optional` **l1?**: `number`

***

### l2?

> `optional` **l2?**: `number`

***

### proofs

> **proofs**: [`WotsSignatureProofHex`](WotsSignatureProofHex.md)[]

***

### rootPublicKey

> **rootPublicKey**: `string`
