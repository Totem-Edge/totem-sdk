[**@totemsdk/pear**](../index.md)

***

[@totemsdk/pear](../index.md) / BareKVStoreOptions

# Interface: BareKVStoreOptions

## Properties

### \_bee?

> `optional` **\_bee?**: [`HypebeeLike`](HypebeeLike.md)

Pre-constructed Hyperbee instance — for testing or when the caller
manages the Hypercore lifecycle.

***

### storagePath?

> `optional` **storagePath?**: `string`

Path on disk for the Hypercore that backs this Hyperbee.
Ignored when `_bee` is provided.
