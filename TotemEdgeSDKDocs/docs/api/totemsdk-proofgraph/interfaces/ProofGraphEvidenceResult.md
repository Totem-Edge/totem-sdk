[**@totemsdk/proofgraph**](../index.md)

***

[@totemsdk/proofgraph](../index.md) / ProofGraphEvidenceResult

# Interface: ProofGraphEvidenceResult

Per-evidence-node restore result.

## Properties

### bytes?

> `optional` **bytes?**: `Uint8Array`\<`ArrayBufferLike`\>

***

### contentHash?

> `optional` **contentHash?**: `string`

The claim commitment this evidence is bound to, when known.

***

### message?

> `optional` **message?**: `string`

***

### nodeId

> **nodeId**: `string`

***

### ref?

> `optional` **ref?**: `ArtifactRef`

***

### status

> **status**: `"ok"` \| `"not-found"` \| `"corrupt"` \| `"unavailable"`
