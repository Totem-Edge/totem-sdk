[**@totemsdk/location-proof**](../index.md)

***

[@totemsdk/location-proof](../index.md) / addLocationProofToGraph

# Function: addLocationProofToGraph()

> **addLocationProofToGraph**(`graph`, `signed`): `ProofGraph`

Index a signed location proof into a proof graph (immutable — returns a
new graph). Delegates to @totemsdk/proofgraph's addProof, which creates
the proof / identity / subject / evidence nodes and proves / issued_by /
about / references edges.

## Parameters

### graph

`ProofGraph`

### signed

`SignedProof`

## Returns

`ProofGraph`
