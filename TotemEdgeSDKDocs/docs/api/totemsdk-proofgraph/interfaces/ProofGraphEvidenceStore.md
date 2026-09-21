[**@totemsdk/proofgraph**](../index.md)

***

[@totemsdk/proofgraph](../index.md) / ProofGraphEvidenceStore

# Interface: ProofGraphEvidenceStore

## Methods

### listCount()

> **listCount**(): `Promise`\<`number`\>

Count of local index entries (persisted evidence mappings).

#### Returns

`Promise`\<`number`\>

***

### putEvidence()

> **putEvidence**(`graph`, `bytesFor`): `Promise`\<`ArtifactRef`[]\>

Persist evidence bytes for every `evidence` node of `graph`.
`bytesFor` maps a node id to the bytes to store; nodes with no bytes are
skipped. Returns the refs persisted, in graph node order.

#### Parameters

##### graph

[`ProofGraph`](ProofGraph.md)

##### bytesFor

(`nodeId`) => `Uint8Array`\<`ArrayBufferLike`\> \| `undefined`

#### Returns

`Promise`\<`ArtifactRef`[]\>

***

### restoreEvidence()

> **restoreEvidence**(`graph`): `Promise`\<[`ProofGraphEvidenceResult`](ProofGraphEvidenceResult.md)[]\>

Restore evidence bytes for every `evidence` node of `graph`, verifying
each artifact's committed digest on read. With `strict` (default), corrupt
or unavailable reads throw; otherwise a per-node result is returned.

#### Parameters

##### graph

[`ProofGraph`](ProofGraph.md)

#### Returns

`Promise`\<[`ProofGraphEvidenceResult`](ProofGraphEvidenceResult.md)[]\>
