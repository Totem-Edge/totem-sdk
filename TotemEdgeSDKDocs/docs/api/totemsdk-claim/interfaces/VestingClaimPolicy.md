[**@totemsdk/claim**](../index.md)

***

[@totemsdk/claim](../index.md) / VestingClaimPolicy

# Interface: VestingClaimPolicy

## Properties

### beneficiary

> **beneficiary**: `string`

***

### cliffBlock

> **cliffBlock**: `number`

***

### endBlock

> **endBlock**: `number`

***

### owner

> **owner**: `string`

***

### startBlock

> **startBlock**: `number`

***

### totalAmount?

> `optional` **totalAmount?**: `bigint`

Total vesting allocation. When omitted the amount is taken from
`ClaimContext.totalAmount` (and, on the authoritative path, defaults to the
claimed asset's amount). Evaluation fails closed when no total is available.

***

### type

> **type**: `"vesting"`
