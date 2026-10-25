[**@totemsdk/se-server**](../index.md)

***

[@totemsdk/se-server](../index.md) / SeIdentityOptions

# Interface: SeIdentityOptions

## Properties

### childIndex?

> `readonly` `optional` **childIndex?**: `number`

Child slot the SE signs from (default 0). Federation generalizes this to a member list.

***

### proofVersion?

> `readonly` `optional` **proofVersion?**: `number`

Monotonic identity-proof version (bump on rotation/revocation).

***

### seed

> `readonly` **seed**: `Uint8Array`

32-byte SE seed.

***

### storage

> `readonly` **storage**: `StorageAdapter`

Durable storage for the lease watermark/journal and the identity watermark.

***

### treeId?

> `readonly` `optional` **treeId?**: `string`

Lease tree id (default `se-identity`).

***

### ttlMs?

> `readonly` `optional` **ttlMs?**: `number`

Reservation TTL for the lease (default 60s).
