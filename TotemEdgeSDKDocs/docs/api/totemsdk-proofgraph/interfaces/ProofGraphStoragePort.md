[**@totemsdk/proofgraph**](../index.md)

***

[@totemsdk/proofgraph](../index.md) / ProofGraphStoragePort

# Interface: ProofGraphStoragePort

Storage port — interface only, no concrete implementation in this package.
Adapters (SQLite, LevelDB, in-memory) live in consumer packages.

## Methods

### findByNodeId()

> **findByNodeId**(`id`): `Promise`\<[`ProofGraph`](ProofGraph.md) \| `null`\>

#### Parameters

##### id

`string`

#### Returns

`Promise`\<[`ProofGraph`](ProofGraph.md) \| `null`\>

***

### load()

> **load**(`graphId`): `Promise`\<[`ProofGraph`](ProofGraph.md) \| `null`\>

#### Parameters

##### graphId

`string`

#### Returns

`Promise`\<[`ProofGraph`](ProofGraph.md) \| `null`\>

***

### save()

> **save**(`graph`): `Promise`\<`void`\>

#### Parameters

##### graph

[`ProofGraph`](ProofGraph.md)

#### Returns

`Promise`\<`void`\>
