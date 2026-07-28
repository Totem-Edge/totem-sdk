[**@totemsdk/proofgraph**](../index.md)

***

[@totemsdk/proofgraph](../index.md) / getEvidenceTrail

# Function: getEvidenceTrail()

> **getEvidenceTrail**(`graph`, `proofId`): [`ProofGraphNode`](../interfaces/ProofGraphNode.md)[]

Traverse 'references' edges from a proof to its evidence nodes.
Returns nodes in insertion order (the order edges were added, which matches
the original evidence array order from addProof).

## Parameters

### graph

[`ProofGraph`](../interfaces/ProofGraph.md)

### proofId

`string`

## Returns

[`ProofGraphNode`](../interfaces/ProofGraphNode.md)[]
