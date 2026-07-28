[**@totemsdk/proofgraph**](../index.md)

***

[@totemsdk/proofgraph](../index.md) / resolveCurrentProofSet

# Function: resolveCurrentProofSet()

> **resolveCurrentProofSet**(`graph`): [`ProofGraphNode`](../interfaces/ProofGraphNode.md)[]

Return all proof nodes that are NOT the target of any 'revokes' or 'supersedes' edge.
These are the current / active proofs in the graph.

## Parameters

### graph

[`ProofGraph`](../interfaces/ProofGraph.md)

## Returns

[`ProofGraphNode`](../interfaces/ProofGraphNode.md)[]
