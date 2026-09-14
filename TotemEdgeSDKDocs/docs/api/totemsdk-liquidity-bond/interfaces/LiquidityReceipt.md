[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / LiquidityReceipt

# Interface: LiquidityReceipt

## Properties

### amount

> **amount**: `bigint`

***

### asset

> **asset**: `string`

***

### consumedAt?

> `optional` **consumedAt?**: `number`

Set when the receipt was consumed by a withdrawal (single-spend).

***

### consumedIntentId?

> `optional` **consumedIntentId?**: `string`

***

### effectiveAmount?

> `optional` **effectiveAmount?**: `bigint`

***

### expiresAt?

> `optional` **expiresAt?**: `number`

***

### issuedAt

> **issuedAt**: `number`

***

### metadata?

> `optional` **metadata?**: `Record`\<`string`, `unknown`\>

***

### nonce

> **nonce**: `string`

Per-position nonce — makes the receipt single-spend and non-replayable.

***

### ownerAddress

> **ownerAddress**: `string`

***

### ownerIdentityId?

> `optional` **ownerIdentityId?**: `string`

***

### poolId

> **poolId**: `string`

***

### positionId

> **positionId**: `string`

***

### proofRef?

> `optional` **proofRef?**: [`LiquidityProofRef`](LiquidityProofRef.md)

***

### receiptHash

> **receiptHash**: `string`

***

### receiptId

> **receiptId**: `string`
