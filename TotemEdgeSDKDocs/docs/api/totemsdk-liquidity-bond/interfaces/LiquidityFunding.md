[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / LiquidityFunding

# Interface: LiquidityFunding

Structured funding proof. "Verified" here means an on-chain check, never a
declared string: a coin that exists, is unspent, is owned by the LP, and
covers the claimed token+amount. `chain-confirmed` is set only by
`confirmLiquidityCommitment` after `verifyDeposit` passes.

## Properties

### amount

> **amount**: `bigint`

***

### confirmedAt?

> `optional` **confirmedAt?**: `number`

***

### mmrProof?

> `optional` **mmrProof?**: `unknown`

***

### status

> **status**: `"declared"` \| `"chain-confirmed"` \| `"invalid"`

***

### tokenId

> **tokenId**: `string`

***

### txpowId?

> `optional` **txpowId?**: `string`

***

### utxoRef

> **utxoRef**: `string`
