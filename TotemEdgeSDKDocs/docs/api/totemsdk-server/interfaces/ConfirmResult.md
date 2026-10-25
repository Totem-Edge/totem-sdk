[**@totemsdk/server**](../index.md)

***

[@totemsdk/server](../index.md) / ConfirmResult

# Interface: ConfirmResult

## Properties

### balanceDelta?

> `optional` **balanceDelta?**: `object`

Present when `expect` was supplied and the balance was readable.

#### after

> **after**: `string`

#### before

> **before**: `string`

#### tokenId

> **tokenId**: `string`

***

### blockHeight?

> `optional` **blockHeight?**: `number`

Block height of the confirming block (when confirmed).

***

### confirmingTxPowId?

> `optional` **confirmingTxPowId?**: `string`

The confirming txpow id (when available).

***

### expectationMet?

> `optional` **expectationMet?**: `boolean`

Present when `expect` was evaluated.

***

### reason?

> `optional` **reason?**: `string`

Human-readable detail for `timeout`/`failed`/mismatch.

***

### status

> **status**: `"confirmed"` \| `"timeout"` \| `"failed"`

***

### txpowId

> **txpowId**: `string`
