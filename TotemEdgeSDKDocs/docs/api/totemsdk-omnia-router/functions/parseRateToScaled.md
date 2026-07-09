[**@totemsdk/omnia-router**](../index.md)

***

[@totemsdk/omnia-router](../index.md) / parseRateToScaled

# Function: parseRateToScaled()

> **parseRateToScaled**(`rate`): `bigint`

Parse a decimal rate string to a scaled bigint (SCALE = 10^8).
"0.95" → 95_000_000n, "1.5" → 150_000_000n, "2" → 200_000_000n.

## Parameters

### rate

`string`

## Returns

`bigint`
