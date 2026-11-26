[**@totemsdk/replication**](../index.md)

***

[@totemsdk/replication](../index.md) / ReplicatedRead

# Interface: ReplicatedRead\<T\>

## Type Parameters

### T

`T`

## Properties

### complete

> `readonly` **complete**: `boolean`

***

### freshness

> `readonly` **freshness**: [`ReplicaFreshness`](../type-aliases/ReplicaFreshness.md)

***

### observedAt?

> `readonly` `optional` **observedAt?**: `number`

***

### source

> `readonly` **source**: `"none"` \| `"replica"` \| `"primary"`

***

### value

> `readonly` **value**: `T` \| `null`
