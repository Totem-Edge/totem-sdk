[**@totemsdk/omnia-splice**](../index.md)

***

[@totemsdk/omnia-splice](../index.md) / SpliceSuccessorOptions

# Interface: SpliceSuccessorOptions

## Properties

### address

> **address**: `string`

Channel funding address the successor must pay to.

***

### amount

> **amount**: `bigint`

Exact successor amount.

***

### confirmations?

> `optional` **confirmations?**: `number`

Confirmations required before the channel is active. Default 1.

***

### now?

> `optional` **now?**: () => `number`

Absolute deadline override (used by recovery paths).

#### Returns

`number`

***

### pollIntervalMs?

> `optional` **pollIntervalMs?**: `number`

Poll interval. Default 1s.

***

### predecessorCoinId?

> `optional` **predecessorCoinId?**: `string`

Coin the splice must consume — normally the channel's funding coin.

***

### requireLineage?

> `optional` **requireLineage?**: `boolean`

Require proof that the successor is an output of `spliceTxId`. Defaults to
true when `spliceTxId` is supplied. Set false only for a caller that has
established provenance some other way.

***

### sleep?

> `optional` **sleep?**: (`ms`) => `Promise`\<`void`\>

Injected sleep (tests).

#### Parameters

##### ms

`number`

#### Returns

`Promise`\<`void`\>

***

### spliceTxId?

> `optional` **spliceTxId?**: `string`

The splice transaction this successor must belong to (OMN-074). Supplying
it turns lineage verification on by default.

***

### timeoutMs?

> `optional` **timeoutMs?**: `number`

Give up after this long and leave the channel funding-pending. Default 30s.

***

### tokenId

> **tokenId**: `string`

Token id of the channel coin.
