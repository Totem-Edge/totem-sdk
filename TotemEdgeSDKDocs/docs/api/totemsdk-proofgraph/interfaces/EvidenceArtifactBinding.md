[**@totemsdk/proofgraph**](../index.md)

***

[@totemsdk/proofgraph](../index.md) / EvidenceArtifactBinding

# Interface: EvidenceArtifactBinding

RFC-007 Amendment A (A3): the enforced binding between a claim's commitment
and the artifact that addresses it.

Invariant: `contentHash === artifact.digest`. `assertEvidenceBinding` throws
`StorageError('corrupt')` when it does not hold, so an unrecoverable
commitment cannot be constructed or restored.

## Properties

### artifact

> `readonly` **artifact**: `ArtifactRef`

The content-addressed artifact; `artifact.digest` must equal `contentHash`.

***

### contentHash

> `readonly` **contentHash**: `string`

The commitment from the claim (hex, with or without `0x`).

***

### nodeId

> `readonly` **nodeId**: `string`
