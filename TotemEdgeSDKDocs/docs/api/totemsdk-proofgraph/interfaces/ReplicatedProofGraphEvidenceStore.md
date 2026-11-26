[**@totemsdk/proofgraph**](../index.md)

***

[@totemsdk/proofgraph](../index.md) / ReplicatedProofGraphEvidenceStore

# Interface: ReplicatedProofGraphEvidenceStore

## Methods

### getEvidence()

> **getEvidence**(`nodeId`): `Promise`\<[`ReplicatedEvidenceRead`](ReplicatedEvidenceRead.md)\>

#### Parameters

##### nodeId

`string`

#### Returns

`Promise`\<[`ReplicatedEvidenceRead`](ReplicatedEvidenceRead.md)\>

***

### listEvidence()

> **listEvidence**(): `AsyncIterable`\<[`ReplicatedEvidenceIndexEntry`](ReplicatedEvidenceIndexEntry.md)\>

#### Returns

`AsyncIterable`\<[`ReplicatedEvidenceIndexEntry`](ReplicatedEvidenceIndexEntry.md)\>

***

### putEvidence()

> **putEvidence**(`graph`, `bytesFor`): `Promise`\<`ArtifactRef`[]\>

#### Parameters

##### graph

[`ProofGraph`](ProofGraph.md)

##### bytesFor

(`nodeId`) => `Uint8Array`\<`ArrayBufferLike`\> \| `undefined`

#### Returns

`Promise`\<`ArtifactRef`[]\>

***

### verifyEvidence()

> **verifyEvidence**(`nodeId`): `Promise`\<`boolean`\>

#### Parameters

##### nodeId

`string`

#### Returns

`Promise`\<`boolean`\>
