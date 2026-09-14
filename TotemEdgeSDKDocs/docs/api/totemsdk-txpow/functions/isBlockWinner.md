[**@totemsdk/txpow**](../index.md)

***

[@totemsdk/txpow](../index.md) / isBlockWinner

# Function: isBlockWinner()

> **isBlockWinner**(`txpowId`, `blockDifficulty`): `boolean`

Check whether a txpowId beats the block target (i.e. is a genuine Minima block).
valid = txpowId < blockDifficulty (big-endian 256-bit comparison).

## Parameters

### txpowId

`Uint8Array`

### blockDifficulty

`string`

## Returns

`boolean`
