[**@totemsdk/storage**](../index.md)

***

[@totemsdk/storage](../index.md) / Journal

# Interface: Journal\<T\>

## Type Parameters

### T

`T`

## Methods

### append()

> **append**(`record`): `Promise`\<[`JournalEntry`](JournalEntry.md)\<`T`\>\>

Append one record; returns the immutable entry.

#### Parameters

##### record

`T`

#### Returns

`Promise`\<[`JournalEntry`](JournalEntry.md)\<`T`\>\>

***

### appendBatch()

> **appendBatch**(`records`): `Promise`\<[`JournalEntry`](JournalEntry.md)\<`T`\>[]\>

Append records in order. Not atomic across adapters (append-only records
are immutable, so a failure partway is an unrecorded tail, repaired by
`recover()`); entries are appendable one-at-a-time.

#### Parameters

##### records

readonly `T`[]

#### Returns

`Promise`\<[`JournalEntry`](JournalEntry.md)\<`T`\>[]\>

***

### count()

> **count**(): `Promise`\<`number`\>

Number of durably-recorded entries (contiguous from 1).

#### Returns

`Promise`\<`number`\>

***

### getHead()

> **getHead**(): `Promise`\<`number`\>

Highest contiguous durably-recorded sequence (0 when empty).

#### Returns

`Promise`\<`number`\>

***

### hasState()

> **hasState**(): `Promise`\<`boolean`\>

True when the journal holds any state (head or entries).

#### Returns

`Promise`\<`boolean`\>

***

### read()

> **read**(`fromSeq?`, `toSeq?`): `Promise`\<[`JournalEntry`](JournalEntry.md)\<`T`\>[]\>

Replay records in ascending sequence, `fromSeq`..`toSeq` (default: all records so far).

#### Parameters

##### fromSeq?

`number`

##### toSeq?

`number`

#### Returns

`Promise`\<[`JournalEntry`](JournalEntry.md)\<`T`\>[]\>

***

### readSince()

> **readSince**(`seq`): `Promise`\<[`JournalEntry`](JournalEntry.md)\<`T`\>[]\>

Replay records after `seq` (checkpoint resume), ascending.

#### Parameters

##### seq

`number`

#### Returns

`Promise`\<[`JournalEntry`](JournalEntry.md)\<`T`\>[]\>

***

### recover()

> **recover**(): `Promise`\<[`JournalRecoveryReport`](JournalRecoveryReport.md)\>

Repair a possibly torn head: roll back an unrecorded tail left by a crash
between CAS head bump and entry write; surface any gap below the
contiguous tail as `corrupt`.

#### Returns

`Promise`\<[`JournalRecoveryReport`](JournalRecoveryReport.md)\>

***

### tail()

> **tail**(`count`): `Promise`\<[`JournalEntry`](JournalEntry.md)\<`T`\>[]\>

Last `count` records, ascending (clamped).

#### Parameters

##### count

`number`

#### Returns

`Promise`\<[`JournalEntry`](JournalEntry.md)\<`T`\>[]\>
