[**@totemsdk/vtxo**](../index.md)

***

[@totemsdk/vtxo](../index.md) / verifyVtxoMembership

# Function: verifyVtxoMembership()

> **verifyVtxoMembership**(`vtxo`, `pool`): [`VerifyVtxoResult`](../interfaces/VerifyVtxoResult.md)

Anchor a VTXO proof to a pool: the proof must be present, its root must be
a root the pool published, and (when the pool records membership) the VTXO
must be a member with the matching leaf.

Accepts historical epoch roots, so a VTXO minted in an earlier epoch remains
verifiable after later batches (OMN-002 + OMN-010).

## Parameters

### vtxo

[`OmniaVtxo`](../interfaces/OmniaVtxo.md)

### pool

[`OmniaVtxoPool`](../interfaces/OmniaVtxoPool.md)

## Returns

[`VerifyVtxoResult`](../interfaces/VerifyVtxoResult.md)
