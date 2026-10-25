[**@totemsdk/decision**](../index.md)

***

[@totemsdk/decision](../index.md) / validateDistribution

# Function: validateDistribution()

> **validateDistribution**(`distribution`, `options`): `void`

Validate a probability distribution. Complete distributions must cover the
candidate set and sum ≈ 1; partial distributions must be a subset. Partial
values are never padded or renormalized.

## Parameters

### distribution

`Record`\<`string`, `number`\>

### options

[`DistributionValidationOptions`](../interfaces/DistributionValidationOptions.md)

## Returns

`void`
