[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / toRawMinima

# Function: toRawMinima()

> **toRawMinima**(`scaledAmount`, `tokenScale`): `bigint`

Convert a scaled token amount back to raw Minima units.
`rawAmount = scaledAmount / 10^tokenScale`
For native Minima (tokenScale=0), no conversion is needed.

## Parameters

### scaledAmount

`bigint`

### tokenScale

`number`

## Returns

`bigint`
