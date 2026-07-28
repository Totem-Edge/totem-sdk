[**@totemsdk/proofgraph**](../index.md)

***

[@totemsdk/proofgraph](../index.md) / addProof

# Function: addProof()

> **addProof**(`graph`, `signedProof`): [`ProofGraph`](../interfaces/ProofGraph.md)

Index a SignedProof into the graph.

Nodes created:
  proof      — proofId (stores the full SignedProof in .data)
  identity   — signature.address (issuer key address)
  subject    — proof.subject.id
  evidence   — ev.id (one per evidence ref)
  anchor     — anchor.hash (if present)

Edges created (all referencing the proofId):
  proves      proof → subject
  issued_by   proof → identity (signer)
  about       proof → subject
  references  proof → evidence (one per evidence ref, in array order)
  anchored_to proof → anchor (if present)

## Parameters

### graph

[`ProofGraph`](../interfaces/ProofGraph.md)

### signedProof

`SignedProof`

## Returns

[`ProofGraph`](../interfaces/ProofGraph.md)
