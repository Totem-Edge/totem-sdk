[**@totemsdk/location-proof**](../index.md)

***

[@totemsdk/location-proof](../index.md) / locationProofToGraphEdges

# Function: locationProofToGraphEdges()

> **locationProofToGraphEdges**(`signed`): `ProofGraphEdge`[]

Build ProofGraphEdges for a signed location proof:
  about       proof → subject
  references  proof → each evidence ref
  supports    each evidence ref → proof

Edge IDs are deterministic (content-derived in @totemsdk/proofgraph).

## Parameters

### signed

`SignedProof`

## Returns

`ProofGraphEdge`[]
