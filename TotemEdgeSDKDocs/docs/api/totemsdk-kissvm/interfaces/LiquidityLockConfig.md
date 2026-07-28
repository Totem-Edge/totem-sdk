[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / LiquidityLockConfig

# Interface: LiquidityLockConfig

## Properties

### amount

> **amount**: `string`

***

### amountPort?

> `optional` **amountPort?**: `number`

Port for the lock amount (default 0).

***

### governancePort?

> `optional` **governancePort?**: `number`

Port for the fee recipient address (default 3).

***

### providerPk

> **providerPk**: `string`

***

### statusPort?

> `optional` **statusPort?**: `number`

Port for position status (default 2).

***

### tokenId

> **tokenId**: `string`

***

### unlockBlock

> **unlockBlock**: `bigint`

Unlock block (pre-computed as cliffBlock + unlockAfterBlock).

***

### unlockPort?

> `optional` **unlockPort?**: `number`

Port for the unlock block (default 1).
