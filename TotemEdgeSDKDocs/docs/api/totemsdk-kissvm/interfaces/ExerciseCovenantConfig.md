[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / ExerciseCovenantConfig

# Interface: ExerciseCovenantConfig

## Properties

### beneficiary

> **beneficiary**: `string`

Beneficiary identity and exact payout destination (WOTS public-key digest,
hex). Used both as the `SIGNEDBY` identity and the `VERIFYOUT` address, so
the exercised value can only reach this party.

***

### condition?

> `optional` **condition?**: `string`

Objective condition that opens the exercise branch, as a KISSVM boolean
expression (e.g. `MAST(0x<conditionRoot>)`, `SIGNEDBY(0x<oracle>)`,
`@BLOCK GTE 500000`). When omitted, the default is the committed time window
`maturity ≤ @BLOCK < recovery`.

***

### kind

> **kind**: [`ExerciseKind`](../type-aliases/ExerciseKind.md)

What opens the exercise branch (documentation + default condition shape).

***

### maturityPort?

> `optional` **maturityPort?**: `number`

State port carrying the absolute maturity block. Default 100.

***

### payout?

> `optional` **payout?**: `bigint`

Exact amount (atoms) the beneficiary receives on exercise. When omitted the
beneficiary receives the whole balance (`@AMOUNT`). When set, any excess
above `payout` returns to [remainderTo](#remainderto).

***

### recovery

> **recovery**: `string`

Owner / recovery identity and destination (hex). Reclaims the whole balance
through the recovery branch only after the exercise window closes.

***

### recoveryPort?

> `optional` **recoveryPort?**: `number`

State port carrying the absolute recovery block. Default 101.

***

### remainderTo?

> `optional` **remainderTo?**: `string`

Destination for the remainder when `payout < @AMOUNT` (hex). Defaults to the
recovery/owner address.

***

### requireSignature?

> `optional` **requireSignature?**: `boolean`

Require the beneficiary's signature to exercise (default `true`). The owner
never signs either way. Set `false` for a permissionless trigger whose payout
is still fixed to the beneficiary.

***

### tokenId?

> `optional` **tokenId?**: `string`

Asset id (hex). Defaults to `0x00` (MINIMA).
