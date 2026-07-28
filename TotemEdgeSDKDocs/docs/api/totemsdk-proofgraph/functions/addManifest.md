[**@totemsdk/proofgraph**](../index.md)

***

[@totemsdk/proofgraph](../index.md) / addManifest

# Function: addManifest()

> **addManifest**(`graph`, `signedManifest`): [`ProofGraph`](../interfaces/ProofGraph.md)

Index a SignedManifest into the graph.

Nodes created:
  manifest — computed manifest ID (stores manifest content in .data)
  address  — resolved author/agent/operator address

Edge created:
  manifests_as  manifest → address

## Parameters

### graph

[`ProofGraph`](../interfaces/ProofGraph.md)

### signedManifest

`SignedManifest`

## Returns

[`ProofGraph`](../interfaces/ProofGraph.md)
