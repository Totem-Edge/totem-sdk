[**@totemsdk/vtxo**](../index.md)

***

[@totemsdk/vtxo](../index.md) / buildVtxoProofSetFromMembers

# Function: buildVtxoProofSetFromMembers()

> **buildVtxoProofSetFromMembers**(`members`): [`VtxoProofSet`](../interfaces/VtxoProofSet.md)

Build one proof set over an existing membership set.

Sorting is by `vtxoId`, so appending a member never changes the position of
an existing member relative to the others and the leaf of an existing VTXO
is never recomputed (OMN-002).

## Parameters

### members

readonly [`VtxoCommitmentMember`](../interfaces/VtxoCommitmentMember.md)[]

## Returns

[`VtxoProofSet`](../interfaces/VtxoProofSet.md)
