[**@totemsdk/proofgraph**](../index.md)

***

[@totemsdk/proofgraph](../index.md) / reachableFrom

# Function: reachableFrom()

> **reachableFrom**(`graph`, `startRefId`, `_visited?`): `Set`\<`string`\>

Return the set of all node refIds reachable from a given node via directed edges.
Includes the start node itself.

## Parameters

### graph

[`ProofGraph`](../interfaces/ProofGraph.md)

### startRefId

`string`

### \_visited?

`Set`\<`string`\> = `...`

## Returns

`Set`\<`string`\>
