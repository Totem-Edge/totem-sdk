[**@totemsdk/proofgraph**](../index.md)

***

[@totemsdk/proofgraph](../index.md) / importProofGraph

# Function: importProofGraph()

> **importProofGraph**(`json`): [`ProofGraph`](../interfaces/ProofGraph.md)

Deserialize a ProofGraph from a JSON string.

Validates every node and edge against structural constraints, then
recomputes the graphId from nodes + edges. Throws if any constraint
is violated or if the recomputed graphId does not match the stored value.

## Parameters

### json

`string`

## Returns

[`ProofGraph`](../interfaces/ProofGraph.md)

## Throws

Error if parsing, validation, or graphId verification fails.
