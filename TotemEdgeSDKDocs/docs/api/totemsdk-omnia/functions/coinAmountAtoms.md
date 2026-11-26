[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / coinAmountAtoms

# Function: coinAmountAtoms()

> **coinAmountAtoms**(`coin`): `bigint`

Read a coin amount as atoms at a trust boundary.

`ChainStateProvider` returns decimal MINIMA text, which is the production
form. A `bigint` (or a safe integer `number`) can only be an atom count, so
it is taken verbatim — useful for internal callers and test doubles. A
fractional `number` is rejected rather than guessed at.

## Parameters

### coin

#### amount

`string` \| `number` \| `bigint`

## Returns

`bigint`
