[**@totemsdk/omnia-pool**](../index.md)

***

[@totemsdk/omnia-pool](../index.md) / createPositionFromCommitment

# Function: createPositionFromCommitment()

> **createPositionFromCommitment**(`commitment`, `pool`, `registry`, `underlyingRefs?`, `metadata?`): `object`

Create and register a `LiquidityPosition` from an accepted (chain-confirmed)
commitment. The position derives its amount from the confirmed funding, never
from a self-declared number.

## Parameters

### commitment

`LiquidityCommitment`

### pool

`LiquidityPoolManifest`

### registry

`LiquidityBondRegistryState`

### underlyingRefs?

#### factoryId?

`string`

#### omniaChannelId?

`string`

#### routerId?

`string`

#### vtxoPoolId?

`string`

### metadata?

`Record`\<`string`, `unknown`\>

## Returns

`object`

### position

> **position**: `LiquidityPosition`

### registry

> **registry**: `LiquidityBondRegistryState`
