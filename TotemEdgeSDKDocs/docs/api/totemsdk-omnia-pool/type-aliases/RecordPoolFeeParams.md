[**@totemsdk/omnia-pool**](../index.md)

***

[@totemsdk/omnia-pool](../index.md) / RecordPoolFeeParams

# Type Alias: RecordPoolFeeParams

> **RecordPoolFeeParams** = `object`

## Properties

### earnProof?

> `optional` **earnProof?**: `unknown`

Required for earnable sources — the payment proof backing the fee.

***

### grossAmount

> **grossAmount**: `string`

***

### metadata?

> `optional` **metadata?**: `Record`\<`string`, `unknown`\>

***

### pool

> **pool**: `LiquidityPoolManifest`

***

### position

> **position**: `LiquidityPosition`

***

### source

> **source**: `FeeSource`

***

### verified?

> `optional` **verified?**: `boolean`

Set when the earn-proof was verified (see liquidity-bond verifyLiquidityFeeRecord).
