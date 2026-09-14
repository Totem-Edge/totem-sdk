[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / LiquidityBondRegistryState

# Interface: LiquidityBondRegistryState

## Properties

### allocations

> **allocations**: `Record`\<`string`, [`LiquidityAllocation`](LiquidityAllocation.md)[]\>

***

### commitments

> **commitments**: `Record`\<`string`, [`LiquidityCommitment`](LiquidityCommitment.md)\>

***

### feeRecords

> **feeRecords**: `Record`\<`string`, [`LiquidityFeeRecord`](LiquidityFeeRecord.md)[]\>

***

### pools

> **pools**: `Record`\<`string`, [`LiquidityPoolManifest`](LiquidityPoolManifest.md)\>

***

### positions

> **positions**: `Record`\<`string`, [`LiquidityPosition`](LiquidityPosition.md)\>

***

### receipts

> **receipts**: `Record`\<`string`, [`LiquidityReceipt`](LiquidityReceipt.md)\>

***

### root?

> `optional` **root?**: `string`

The accepted registry anchor root — advanced only through signed transitions
(`applyRegistryTransition`). Verifiers require the next transition's
`previousRoot` to match it, so a fabricated registry without the anchor chain
is rejected. Excluded from `serializeRegistryState`/`computeRegistryRoot`.

***

### sequence?

> `optional` **sequence?**: `number`

Monotonic anti-reorg sequence (#34): each applied transition must advance it,
so a `previousRoot` resubmission after a rollback is rejected. Excluded from
the root commitment.

***

### updatedAt?

> `optional` **updatedAt?**: `number`

***

### withdrawals

> **withdrawals**: `Record`\<`string`, [`WithdrawalIntent`](WithdrawalIntent.md)[]\>
