[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / LiquidityFeeRecord

# Interface: LiquidityFeeRecord

## Properties

### earnProof?

> `optional` **earnProof?**: `unknown`

The raw payment proof backing an earnable fee (HTLC fulfillment / route record).

***

### feeAsset

> **feeAsset**: `string`

***

### feeRecordId

> **feeRecordId**: `string`

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

Bound payout for claim/compound reductions (prevents claim-then-fail).

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

### recordedAt

> **recordedAt**: `number`

***

### source

> **source**: [`FeeSource`](../type-aliases/FeeSource.md)

***

### verified?

> `optional` **verified?**: `boolean`

Set only when the earn-proof was verified on-chain/against a payment record.
