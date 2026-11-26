[**@totemsdk/vtxo**](../index.md)

***

[@totemsdk/vtxo](../index.md) / ClaimContext

# Interface: ClaimContext

## Properties

### block

> **block**: `number`

***

### htlc?

> `optional` **htlc?**: `object`

#### hashlock

> **hashlock**: `string`

#### paymentId

> **paymentId**: `string`

#### status

> **status**: `"pending"` \| `"fulfilled"` \| `"timed_out"`

***

### poolId?

> `optional` **poolId?**: `string`

Opaque settlement binding hints. `evaluateClaim` ignores them; adapters use
them to reject a policy evaluated against the wrong pool or asset.

***

### tokenId?

> `optional` **tokenId?**: `string`

***

### totalAmount?

> `optional` **totalAmount?**: `bigint`

Total allocation for vesting policies that do not carry `totalAmount`.
