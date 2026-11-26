[**@totemsdk/wots-lease**](../index.md)

***

[@totemsdk/wots-lease](../index.md) / ReplicatedLeaseJournalBackup

# Class: ReplicatedLeaseJournalBackup

## Constructors

### Constructor

> **new ReplicatedLeaseJournalBackup**(`log`): `ReplicatedLeaseJournalBackup`

#### Parameters

##### log

`ReplicatedLog`\<[`JournalEntry`](../interfaces/JournalEntry.md)\>

#### Returns

`ReplicatedLeaseJournalBackup`

## Methods

### append()

> **append**(`entry`): `Promise`\<\{ `head`: `string`; `length`: `number`; \}\>

Mirror one local journal entry.

#### Parameters

##### entry

[`JournalEntry`](../interfaces/JournalEntry.md)

#### Returns

`Promise`\<\{ `head`: `string`; `length`: `number`; \}\>

***

### readAll()

> **readAll**(): `Promise`\<[`JournalEntry`](../interfaces/JournalEntry.md)[]\>

Read all mirrored entries, verifying the local hash-chain links in order.

#### Returns

`Promise`\<[`JournalEntry`](../interfaces/JournalEntry.md)[]\>

***

### restoreInto()

> **restoreInto**(`target`): `Promise`\<`number`\>

Restore into a local journal. The local journal's own duplicate-slot and
reservation checks remain the final guard; this method only preserves the
replicated order and links.

#### Parameters

##### target

[`LeaseJournalRestoreTarget`](../interfaces/LeaseJournalRestoreTarget.md)

#### Returns

`Promise`\<`number`\>
