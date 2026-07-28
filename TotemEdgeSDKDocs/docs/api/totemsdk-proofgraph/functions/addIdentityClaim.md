[**@totemsdk/proofgraph**](../index.md)

***

[@totemsdk/proofgraph](../index.md) / addIdentityClaim

# Function: addIdentityClaim()

> **addIdentityClaim**(`graph`, `signedClaim`): [`ProofGraph`](../interfaces/ProofGraph.md)

Index a SignedIdentityClaim into the graph.

Nodes created:
  identity-claim — claim.id (stores the full signed claim in .data)
  address        — issuer address
  address/identity — target address (for delegates_to / rotates_to / revokes)

Edges created based on claim.type:
  all types    → issued_by  (claim-node → issuer address)
  delegates_to → delegates_to edge (claim-node → delegated address)
  revokes      → revokes edge      (claim-node → subject identity)
  rotates_to   → controls edge     (claim-node → new address)

## Parameters

### graph

[`ProofGraph`](../interfaces/ProofGraph.md)

### signedClaim

`SignedIdentityClaim`

## Returns

[`ProofGraph`](../interfaces/ProofGraph.md)
