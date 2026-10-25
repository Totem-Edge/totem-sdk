[**@totemsdk/proofgraph**](../index.md)

***

[@totemsdk/proofgraph](../index.md) / addManifestRevision

# Function: addManifestRevision()

> **addManifestRevision**(`graph`, `signedManifest`): [`ProofGraph`](../interfaces/ProofGraph.md)

Add a signed manifest **revision** without collapsing other revisions.

Creates:
  manifest (logical)   refId = manifestId
  manifest (revision)  refId = manifestEnvelopeId, data = { manifestId, manifestEnvelopeId, signedManifest }
  address              resolved author/operator address
  manifests_as         manifestId → address
  revision_of          manifestEnvelopeId → manifestId

## Parameters

### graph

[`ProofGraph`](../interfaces/ProofGraph.md)

### signedManifest

`SignedManifest`

## Returns

[`ProofGraph`](../interfaces/ProofGraph.md)
