[**@totemsdk/proofgraph**](../index.md)

***

[@totemsdk/proofgraph](../index.md) / addNode

# Function: addNode()

> **addNode**(`graph`, `type`, `refId`, `data?`): [`ProofGraph`](../interfaces/ProofGraph.md)

Add a node directly (type + refId pair). Idempotent — skipped if the node already exists.

## Parameters

### graph

[`ProofGraph`](../interfaces/ProofGraph.md)

### type

[`ProofGraphNodeType`](../type-aliases/ProofGraphNodeType.md)

### refId

`string`

### data?

`Record`\<`string`, `unknown`\>

## Returns

[`ProofGraph`](../interfaces/ProofGraph.md)
