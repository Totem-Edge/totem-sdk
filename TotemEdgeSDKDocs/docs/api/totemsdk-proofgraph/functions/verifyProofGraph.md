[**@totemsdk/proofgraph**](../index.md)

***

[@totemsdk/proofgraph](../index.md) / verifyProofGraph

# Function: verifyProofGraph()

> **verifyProofGraph**(`graph`, `_options?`): [`ProofGraphVerifyResult`](../interfaces/ProofGraphVerifyResult.md)

Verify every proof node stored in the graph.

Iterates nodes of type 'proof', casts node.data back to SignedProof,
and calls proofModule.verifyProof() from @totemsdk/proof.
Returns { valid: true } if ALL proofs pass; otherwise lists the failing proofIds.

## Parameters

### graph

[`ProofGraph`](../interfaces/ProofGraph.md)

### \_options?

`Record`\<`string`, `unknown`\>

## Returns

[`ProofGraphVerifyResult`](../interfaces/ProofGraphVerifyResult.md)
