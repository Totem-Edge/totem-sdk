[**@totemsdk/replication-holepunch**](../index.md)

***

[@totemsdk/replication-holepunch](../index.md) / ReplicatedEvidenceNetwork

# Interface: ReplicatedEvidenceNetwork

## Methods

### getEvidence()

> **getEvidence**(`nodeId`): `Promise`\<[`EvidenceNetworkRead`](EvidenceNetworkRead.md)\>

#### Parameters

##### nodeId

`string`

#### Returns

`Promise`\<[`EvidenceNetworkRead`](EvidenceNetworkRead.md)\>

***

### listEvidence()

> **listEvidence**(): `AsyncIterable`\<[`EvidenceIndexEntry`](EvidenceIndexEntry.md)\>

#### Returns

`AsyncIterable`\<[`EvidenceIndexEntry`](EvidenceIndexEntry.md)\>

***

### putEvidence()

> **putEvidence**(`graph`, `bytesFor`): `Promise`\<`ArtifactRef`[]\>

#### Parameters

##### graph

[`EvidenceGraph`](EvidenceGraph.md)

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
