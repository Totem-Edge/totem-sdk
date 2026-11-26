[**@totemsdk/chain-provider**](../index.md)

***

[@totemsdk/chain-provider](../index.md) / Coin

# Interface: Coin

## Properties

### address

> **address**: `string`

***

### amount

> **amount**: `string`

Coin amount exactly as the node reports it: decimal MINIMA text (e.g.
`"0.2"`). Every provider returns this form. Convert with
`amountToAtoms()` from `@totemsdk/core` where integer base units are
required; never assume atoms or a JS number.

***

### coinid

> **coinid**: `string`

***

### created?

> `optional` **created?**: `string`

***

### miniaddress?

> `optional` **miniaddress?**: `string`

***

### mmrentry?

> `optional` **mmrentry?**: `string`

***

### spent?

> `optional` **spent?**: `boolean`

***

### state?

> `optional` **state?**: `unknown`[]

***

### storestate?

> `optional` **storestate?**: `boolean`

***

### token?

> `optional` **token?**: `unknown`

***

### tokenid

> **tokenid**: `string`
