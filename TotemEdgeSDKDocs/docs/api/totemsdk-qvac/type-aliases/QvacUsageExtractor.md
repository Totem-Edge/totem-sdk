[**@totemsdk/qvac**](../index.md)

***

[@totemsdk/qvac](../index.md) / QvacUsageExtractor

# Type Alias: QvacUsageExtractor

> **QvacUsageExtractor** = (`domain`, `op`, `raw`) => `Partial`\<`IntelligenceUsage`\> \| `undefined`

Extracts usage from an op result. Best-effort: looks for `stats`,
`usage`, or flat token/duration fields.

## Parameters

### domain

`string`

### op

`string`

### raw

`unknown`

## Returns

`Partial`\<`IntelligenceUsage`\> \| `undefined`
