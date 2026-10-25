[**@totemsdk/proofgraph**](../index.md)

***

[@totemsdk/proofgraph](../index.md) / PutEvidenceOptions

# Interface: PutEvidenceOptions

## Properties

### contentHashFor?

> `optional` **contentHashFor?**: (`nodeId`) => `string` \| `undefined`

Explicit commitment per node. Falls back to the evidence node's
`data.contentHash` (set by `addProof`). When a commitment is known, the
stored bytes MUST hash to it and the artifact digest MUST equal it, or the
put throws `StorageError('corrupt')`.

#### Parameters

##### nodeId

`string`

#### Returns

`string` \| `undefined`

***

### requireContentHash?

> `optional` **requireContentHash?**: `boolean`

When true, every evidence node must have a commitment — a missing
commitment throws. Default false (back-compat for nodes without one).
