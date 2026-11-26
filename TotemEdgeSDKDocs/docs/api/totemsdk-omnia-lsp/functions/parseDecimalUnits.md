[**@totemsdk/omnia-lsp**](../index.md)

***

[@totemsdk/omnia-lsp](../index.md) / parseDecimalUnits

# Function: parseDecimalUnits()

> **parseDecimalUnits**(`value`, `options?`): [`DecimalParseResult`](../type-aliases/DecimalParseResult.md)

Parse a decimal string into integer units at `LSP_DECIMAL_SCALE`.

Rejects negatives, signs, exponents, leading zeros, empty fractions and any
precision beyond 18 decimal places. Zero is rejected unless `allowZero`.

## Parameters

### value

`string`

### options?

#### allowZero?

`boolean`

## Returns

[`DecimalParseResult`](../type-aliases/DecimalParseResult.md)
