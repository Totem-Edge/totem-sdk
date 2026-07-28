[**@totemsdk/proofgraph**](../index.md)

***

[@totemsdk/proofgraph](../index.md) / addEdge

# Function: addEdge()

> **addEdge**(`graph`, `edge`): [`ProofGraph`](../interfaces/ProofGraph.md)

Append a ProofGraphEdge and recompute graphId. Idempotent by edge ID.
Spec API: addEdge(graph, edge). Use buildEdge() to construct the edge object.

## Parameters

### graph

[`ProofGraph`](../interfaces/ProofGraph.md)

### edge

[`ProofGraphEdge`](../interfaces/ProofGraphEdge.md)

## Returns

[`ProofGraph`](../interfaces/ProofGraph.md)
