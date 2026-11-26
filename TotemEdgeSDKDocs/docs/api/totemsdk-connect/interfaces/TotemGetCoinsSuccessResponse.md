[**@totemsdk/connect**](../index.md)

***

[@totemsdk/connect](../index.md) / TotemGetCoinsSuccessResponse

# Interface: TotemGetCoinsSuccessResponse

## Properties

### allTokens?

> `optional` **allTokens?**: `boolean`

True when the wallet enumerated every token it holds.

***

### coins

> **coins**: `object`[]

#### address

> **address**: `string`

#### amount

> **amount**: `string`

#### artimage?

> `optional` **artimage?**: `string`

#### coinId

> **coinId**: `string`

#### created

> **created**: `string`

#### decimals?

> `optional` **decimals?**: `string` \| `number`

#### mmrEntry?

> `optional` **mmrEntry?**: `string`

MMR entry, when reported.

#### name?

> `optional` **name?**: `string`

Flattened token metadata for convenience.

#### spent?

> `optional` **spent?**: `boolean`

Whether the coin is spent, when reported.

#### state?

> `optional` **state?**: `unknown`[]

Coin state variables, when reported.

#### storeState?

> `optional` **storeState?**: `boolean`

Coin keeps state, when reported.

#### ticker?

> `optional` **ticker?**: `string`

#### token?

> `optional` **token?**: [`TotemCoinTokenMetadata`](TotemCoinTokenMetadata.md)

Token metadata (name, ticker, decimals, artimage) when reported.

#### tokenId

> **tokenId**: `string`

#### webvalidate?

> `optional` **webvalidate?**: `string`

***

### queriedAddresses

> **queriedAddresses**: `number`

***

### success

> **success**: `true`

***

### tokenId

> **tokenId**: `string`

`'*'` when the request asked for all tokens.

***

### totalCoins

> **totalCoins**: `number`
