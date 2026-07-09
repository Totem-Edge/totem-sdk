[**@totemsdk/wots-lease**](../index.md)

***

[@totemsdk/wots-lease](../index.md) / LeaseJournal

# Class: LeaseJournal

## Constructors

### Constructor

> **new LeaseJournal**(`storage`, `logger?`): `LeaseJournal`

#### Parameters

##### storage

`StorageAdapter`

##### logger?

`LoggerAdapter` = `...`

#### Returns

`LeaseJournal`

## Methods

### append()

> **append**(`entry`): `Promise`\<`void`\>

#### Parameters

##### entry

[`JournalEntry`](../interfaces/JournalEntry.md)

#### Returns

`Promise`\<`void`\>

***

### clear()

> **clear**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### getAll()

> **getAll**(): [`JournalEntry`](../interfaces/JournalEntry.md)[]

#### Returns

[`JournalEntry`](../interfaces/JournalEntry.md)[]

***

### getByReservation()

> **getByReservation**(`reservationId`): [`JournalEntry`](../interfaces/JournalEntry.md) \| `undefined`

#### Parameters

##### reservationId

`string`

#### Returns

[`JournalEntry`](../interfaces/JournalEntry.md) \| `undefined`

***

### getByTree()

> **getByTree**(`treeId`): [`JournalEntry`](../interfaces/JournalEntry.md)[]

#### Parameters

##### treeId

`string`

#### Returns

[`JournalEntry`](../interfaces/JournalEntry.md)[]

***

### initialize()

> **initialize**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>
