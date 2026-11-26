[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / coinCreatedBlock

# Function: coinCreatedBlock()

> **coinCreatedBlock**(`coin`): `number` \| `null`

Block height at which a coin was created, or `null` when the provider does not
report a usable height.

`mmrentry` is an MMR leaf index, not a block height — using it as a
confirmation height silently treats an unconfirmed coin as deeply confirmed.
Calling code must treat `null` as unconfirmed (fail closed).

## Parameters

### coin

`ChainCoinView` \| `null` \| `undefined`

## Returns

`number` \| `null`
