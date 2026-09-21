[**@totemsdk/omnia-splice**](../index.md)

***

[@totemsdk/omnia-splice](../index.md) / DurableSpliceStore

# Interface: DurableSpliceStore

## Methods

### getRevision()

> **getRevision**(): `Promise`\<`number`\>

#### Returns

`Promise`\<`number`\>

***

### getSnapshot()

> **getSnapshot**(): `Promise`\<[`SpliceStoreState`](SpliceStoreState.md)\>

#### Returns

`Promise`\<[`SpliceStoreState`](SpliceStoreState.md)\>

***

### getSplice()

> **getSplice**(`spliceId`): `Promise`\<[`SpliceRecord`](SpliceRecord.md) \| `undefined`\>

Retrieve a splice record by spliceId.

#### Parameters

##### spliceId

`string`

#### Returns

`Promise`\<[`SpliceRecord`](SpliceRecord.md) \| `undefined`\>

***

### hasState()

> **hasState**(): `Promise`\<`boolean`\>

#### Returns

`Promise`\<`boolean`\>

***

### listPending()

> **listPending**(): `Promise`\<[`SpliceRecord`](SpliceRecord.md)[]\>

Pending (proposed but not yet accepted) splices — reconcilable after restart.

#### Returns

`Promise`\<[`SpliceRecord`](SpliceRecord.md)[]\>

***

### listSplices()

> **listSplices**(`channelId?`): `Promise`\<[`SpliceRecord`](SpliceRecord.md)[]\>

All records, optionally filtered by channel.

#### Parameters

##### channelId?

`string`

#### Returns

`Promise`\<[`SpliceRecord`](SpliceRecord.md)[]\>

***

### markFinalized()

> **markFinalized**(`spliceId`): `Promise`\<`void`\>

Mark a splice finalized (splice TX confirmed on-chain).

#### Parameters

##### spliceId

`string`

#### Returns

`Promise`\<`void`\>

***

### saveAcceptance()

> **saveAcceptance**(`acceptance`): `Promise`\<`void`\>

Attach an acceptance; updates status to `accepted`.

#### Parameters

##### acceptance

[`SpliceAcceptance`](SpliceAcceptance.md)

#### Returns

`Promise`\<`void`\>

***

### saveProposal()

> **saveProposal**(`proposal`): `Promise`\<`void`\>

Persist a freshly created splice proposal (pending, pre-acceptance).

#### Parameters

##### proposal

[`SpliceProposal`](SpliceProposal.md)

#### Returns

`Promise`\<`void`\>
