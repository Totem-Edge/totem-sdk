[**@totemsdk/proofgraph**](../index.md)

***

[@totemsdk/proofgraph](../index.md) / buildEdge

# Function: buildEdge()

> **buildEdge**(`type`, `from`, `to`, `proofId?`, `data?`): [`ProofGraphEdge`](../interfaces/ProofGraphEdge.md)

Build a ProofGraphEdge with a deterministic ID from its fields.
Convenience helper so callers don't need to import computeEdgeId.

## Parameters

### type

[`ProofGraphEdgeType`](../type-aliases/ProofGraphEdgeType.md)

### from

`string`

### to

`string`

### proofId?

`string`

### data?

`Record`\<`string`, `unknown`\>

## Returns

[`ProofGraphEdge`](../interfaces/ProofGraphEdge.md)
