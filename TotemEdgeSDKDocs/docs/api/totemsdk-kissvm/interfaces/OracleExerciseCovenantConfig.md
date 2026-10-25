[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / OracleExerciseCovenantConfig

# Interface: OracleExerciseCovenantConfig

## Properties

### beneficiary

> **beneficiary**: `string`

Beneficiary identity / exercise destination (hex).

***

### comparison

> **comparison**: `object`

Objective comparison applied to the committed observation value.

#### op

> **op**: [`OracleComparisonOp`](../type-aliases/OracleComparisonOp.md)

#### valueAtoms

> **valueAtoms**: `bigint`

***

### feedPort?

> `optional` **feedPort?**: `number`

State port carrying the feed/schema commitment. Default 123.

***

### maturityPort?

> `optional` **maturityPort?**: `number`

State port carrying the absolute maturity block. Default 100.

***

### observedAtPort?

> `optional` **observedAtPort?**: `number`

State port carrying the observation's earliest-valid block. Default 121.

***

### payout?

> `optional` **payout?**: `bigint`

Exact payout (atoms). When omitted the beneficiary receives the whole balance.

***

### recovery

> **recovery**: `string`

Owner / recovery destination (hex); reclaims after the recovery block.

***

### recoveryPort?

> `optional` **recoveryPort?**: `number`

State port carrying the absolute recovery block. Default 101.

***

### remainderTo?

> `optional` **remainderTo?**: `string`

Remainder destination when `payout < @AMOUNT`. Defaults to the recovery address.

***

### tokenId?

> `optional` **tokenId?**: `string`

Asset id (hex). Defaults to `0x00` (MINIMA).

***

### validUntilPort?

> `optional` **validUntilPort?**: `number`

State port carrying the observation's expiry block. Default 122.

***

### valuePort?

> `optional` **valuePort?**: `number`

State port carrying the observation value. Default 120.
