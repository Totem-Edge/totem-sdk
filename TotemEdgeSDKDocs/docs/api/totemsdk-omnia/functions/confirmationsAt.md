[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / confirmationsAt

# Function: confirmationsAt()

> **confirmationsAt**(`coin`, `tipBlock`): `number` \| `null`

Confirmation depth of a coin at `tipBlock`, or `null` when the depth cannot be
proven (missing/invalid creation height, or a future-dated coin).

## Parameters

### coin

`ChainCoinView` \| `null` \| `undefined`

### tipBlock

`number`

## Returns

`number` \| `null`
