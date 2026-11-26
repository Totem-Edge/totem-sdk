[**@totemsdk/vtxo**](../index.md)

***

[@totemsdk/vtxo](../index.md) / VerifyVtxoOptions

# Interface: VerifyVtxoOptions

## Properties

### allowUnanchored?

> `optional` **allowUnanchored?**: `boolean`

Explicitly opt out of pool anchoring for non-pool or structural
inspection. A VTXO verified this way is NOT a verified claim; never use
this to authorize a transfer or an exit.

***

### expectedRoot?

> `optional` **expectedRoot?**: `string`

The root published by the pool / epoch authority. Required on the
authoritative path: a proof is only accepted when it anchors here.
