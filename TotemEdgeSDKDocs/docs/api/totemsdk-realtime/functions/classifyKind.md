[**@totemsdk/realtime**](../index.md)

***

[@totemsdk/realtime](../index.md) / classifyKind

# Function: classifyKind()

> **classifyKind**(`tokenid`, `decimals`, `total`, `artimage`): `"native"` \| `"token"` \| `"nft"`

Classify a portfolio entry based on its fields.

All three conditions must be met for 'nft':
  1. artimage is present (non-empty string)
  2. decimals === 0
  3. total === '1'

Everything else with a non-'0x00' tokenid is 'token'.

## Parameters

### tokenid

`string`

### decimals

`number`

### total

`string`

### artimage

`string` \| `undefined`

## Returns

`"native"` \| `"token"` \| `"nft"`
