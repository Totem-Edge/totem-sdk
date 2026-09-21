[**@totemsdk/storage**](../index.md)

***

[@totemsdk/storage](../index.md) / RevisionedSnapshotStore

# Interface: RevisionedSnapshotStore\<T\>

## Type Parameters

### T

`T`

## Methods

### getRecord()

> **getRecord**(): `Promise`\<[`SnapshotRecord`](SnapshotRecord.md)\<`T`\>\>

Current record envelope, including `revision`.

#### Returns

`Promise`\<[`SnapshotRecord`](SnapshotRecord.md)\<`T`\>\>

***

### getRevision()

> **getRevision**(): `Promise`\<`number`\>

Current transition counter (0 when no record exists).

#### Returns

`Promise`\<`number`\>

***

### hasState()

> **hasState**(): `Promise`\<`boolean`\>

True when a record has been persisted.

#### Returns

`Promise`\<`boolean`\>

***

### load()

> **load**(): `Promise`\<`T`\>

Current stored state (`empty()` result when no record exists yet).

#### Returns

`Promise`\<`T`\>

***

### mutate()

> **mutate**(`update`): `Promise`\<[`SnapshotRecord`](SnapshotRecord.md)\<`T`\>\>

Apply a whole-state transition under revision-CAS.

#### Parameters

##### update

(`state`) => `T`

#### Returns

`Promise`\<[`SnapshotRecord`](SnapshotRecord.md)\<`T`\>\>
