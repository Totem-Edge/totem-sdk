[**@totemsdk/storage**](../index.md)

***

[@totemsdk/storage](../index.md) / SnapshotRecord

# Interface: SnapshotRecord\<T\>

## Type Parameters

### T

`T`

## Properties

### revision

> `readonly` **revision**: `number`

Monotonic transition counter — advanced on every mutation.

***

### savedAt

> `readonly` **savedAt**: `number`

***

### state

> `readonly` **state**: `T`

***

### version

> `readonly` **version**: `number`

In-record format version (`SNAPSHOT_RECORD_VERSION`).
