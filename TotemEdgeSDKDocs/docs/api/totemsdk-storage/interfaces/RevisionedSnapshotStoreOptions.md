[**@totemsdk/storage**](../index.md)

***

[@totemsdk/storage](../index.md) / RevisionedSnapshotStoreOptions

# Interface: RevisionedSnapshotStoreOptions\<T\>

## Type Parameters

### T

`T`

## Properties

### empty

> `readonly` **empty**: () => `T`

Build a pristine state when no record exists.

#### Returns

`T`

***

### namespace?

> `readonly` `optional` **namespace?**: `string`

Key namespace prefix; default `totem_snapshot:v1:`.

***

### requireAckMode?

> `readonly` `optional` **requireAckMode?**: `"volatile"` \| `"buffered"` \| `"durably-acknowledged"`

Required write acknowledgment; default `durably-acknowledged`. Pass
`volatile` only for tests/scratch adapters (e.g. `MemoryStore`).

***

### validate?

> `readonly` `optional` **validate?**: (`state`) => `void`

Structural validation hook run over a loaded state. Throw
`StorageError('corrupt')` for anything a consumer refuses to open —
corruption is surfaced, never treated as absence.

#### Parameters

##### state

`T`

#### Returns

`void`
