[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / sumLpFeesForPosition

# Function: sumLpFeesForPosition()

> **sumLpFeesForPosition**(`records`, `positionId`): `bigint`

Sum LP fees for a position, counting only records whose earnings are
verified (or non-earnable adjustments). An unverified earnable record must
never inflate an LP's entitlement.

## Parameters

### records

[`LiquidityFeeRecord`](../interfaces/LiquidityFeeRecord.md)[]

### positionId

`string`

## Returns

`bigint`
