[**@totemsdk/storage**](../index.md)

***

[@totemsdk/storage](../index.md) / JournalOptions

# Interface: JournalOptions\<T\>

## Type Parameters

### T

`T`

## Properties

### migrate?

> `readonly` `optional` **migrate?**: (`version`, `record`) => `T`

Forward-migrate an older record version to the current shape. Invoked on
every read of an entry whose `version` predates `JOURNAL_RECORD_VERSION`.
A migration that cannot be performed, or an entry whose version exceeds
the current one, refuses to open as `corrupt` — never silent.

#### Parameters

##### version

`number`

##### record

`unknown`

#### Returns

`T`

***

### namespace?

> `readonly` `optional` **namespace?**: `string`

Key namespace prefix; default `totem_journal:v1:`.

***

### requireAckMode?

> `readonly` `optional` **requireAckMode?**: `"volatile"` \| `"buffered"` \| `"durably-acknowledged"`

Required write acknowledgment; default `durably-acknowledged`. Pass
`volatile` only for tests/dev adapters (e.g. `MemoryStore`).

***

### validate?

> `readonly` `optional` **validate?**: (`record`) => `void`

Optional structural validation run on every appended/read record.

#### Parameters

##### record

`T`

#### Returns

`void`
