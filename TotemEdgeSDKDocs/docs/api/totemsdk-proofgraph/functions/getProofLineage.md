[**@totemsdk/proofgraph**](../index.md)

***

[@totemsdk/proofgraph](../index.md) / getProofLineage

# Function: getProofLineage()

> **getProofLineage**(`graph`, `proofId`, `_visited?`): [`ProofGraphNode`](../interfaces/ProofGraphNode.md)[]

Recursively traverse 'derived_from' edges from a proof node.
Returns the ordered chain of ancestor proof nodes (closest ancestor first).
Terminates on cycle detection.

## Parameters

### graph

[`ProofGraph`](../interfaces/ProofGraph.md)

### proofId

`string`

### \_visited?

`Set`\<`string`\> = `...`

## Returns

[`ProofGraphNode`](../interfaces/ProofGraphNode.md)[]
