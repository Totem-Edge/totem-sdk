[**@totemsdk/storage**](../index.md)

***

[@totemsdk/storage](../index.md) / JournalEntry

# Interface: JournalEntry\<T\>

One immutable journal entry.

## Type Parameters

### T

`T`

## Properties

### createdAt

> `readonly` **createdAt**: `number`

***

### record

> `readonly` **record**: `T`

***

### seq

> `readonly` **seq**: `number`

Monotonic, collision-free sequence (1-based; 0 = no entries).

***

### version

> `readonly` **version**: `number`

Format version of this entry's record (forward-migratable on read).
