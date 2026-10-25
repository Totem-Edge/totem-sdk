[**@totemsdk/wots-lease**](../index.md)

***

[@totemsdk/wots-lease](../index.md) / SeedLeaseWatermarkParams

# Interface: SeedLeaseWatermarkParams

## Properties

### exported?

> `readonly` `optional` **exported?**: [`WatermarkSeed`](WatermarkSeed.md)

Exported watermark blob.

***

### fresh?

> `readonly` `optional` **fresh?**: `boolean`

Declares the keyspace fresh/unspent, so cursor 0 is safe.

***

### local

> `readonly` **local**: [`LocalLeaseProvider`](../classes/LocalLeaseProvider.md)

***

### onchain?

> `readonly` `optional` **onchain?**: [`OnchainWatermarkProvider`](../classes/OnchainWatermarkProvider.md)

Layer 5 — the on-chain cursor is authoritative when reachable.

***

### operatorHighWaterMark?

> `readonly` `optional` **operatorHighWaterMark?**: `number`

Operator-provided flat high-water mark.

***

### treeId

> `readonly` **treeId**: `string`
