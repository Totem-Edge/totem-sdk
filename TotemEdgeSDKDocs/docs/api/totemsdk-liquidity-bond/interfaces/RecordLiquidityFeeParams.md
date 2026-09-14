[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / RecordLiquidityFeeParams

# Interface: RecordLiquidityFeeParams

## Properties

### earnProof?

> `optional` **earnProof?**: `unknown`

Required for earnable sources — the payment proof that backs the fee.

***

### feeAsset

> **feeAsset**: `string`

***

### grossFeeAmount

> **grossFeeAmount**: `bigint`

***

### lpFeeAmount?

> `optional` **lpFeeAmount?**: `bigint`

***

### metadata?

> `optional` **metadata?**: `Record`\<`string`, `unknown`\>

***

### operatorFeeAmount?

> `optional` **operatorFeeAmount?**: `bigint`

***

### payoutRef?

> `optional` **payoutRef?**: [`FeePayoutRef`](FeePayoutRef.md)

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

### recordedAt?

> `optional` **recordedAt?**: `number`

***

### source

> **source**: [`FeeSource`](../type-aliases/FeeSource.md)

***

### verified?

> `optional` **verified?**: `boolean`

When set, the earn-proof was verified (see `verifyLiquidityFeeRecord`).
