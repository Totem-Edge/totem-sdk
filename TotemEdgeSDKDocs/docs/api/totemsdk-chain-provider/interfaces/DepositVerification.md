[**@totemsdk/chain-provider**](../index.md)

***

[@totemsdk/chain-provider](../index.md) / DepositVerification

# Interface: DepositVerification

Granular result of a deposit-funding check. `valid` is the all-gates AND.

## Properties

### amountSufficient

> **amountSufficient**: `boolean`

Coin amount covers the claimed amount.

***

### coin?

> `optional` **coin?**: [`Coin`](Coin.md)

The coin as observed on-chain.

***

### confirmed

> **confirmed**: `boolean`

Coin is confirmed on-chain (not a mempool entry).

***

### error?

> `optional` **error?**: `unknown`

***

### exists

> **exists**: `boolean`

***

### ownedByOwner

> **ownedByOwner**: `boolean`

Coin address equals the claimed owner (Mx or 0x-root form).

***

### reason?

> `optional` **reason?**: `string`

***

### tokenMatches

> **tokenMatches**: `boolean`

Coin tokenid matches the requested token (or base token when none given).

***

### unspent

> **unspent**: `boolean`

Coin exists and is not spent (on-chain confirm, not declared).

***

### valid

> **valid**: `boolean`
