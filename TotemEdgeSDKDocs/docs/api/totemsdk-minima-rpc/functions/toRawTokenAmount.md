[**@totemsdk/minima-rpc**](../index.md)

***

[@totemsdk/minima-rpc](../index.md) / toRawTokenAmount

# Function: toRawTokenAmount()

> **toRawTokenAmount**(`amount`, `tokenScale`): `string`

Convert a human token amount (e.g. `"1.5"`) to the token's smallest raw unit
for a known token scale (`8` → `"150000000"`).

## Parameters

### amount

`string`

### tokenScale

`number`

## Returns

`string`

## Throws

when the amount is negative/NaN or carries more decimal places than
  the token scale allows (that would be a fractional raw unit).
