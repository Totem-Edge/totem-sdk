[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / buildLiquidityLockScript

# Function: buildLiquidityLockScript()

> **buildLiquidityLockScript**(`config`): `string`

Build a liquidity lock script that enforces:
  1. Position status is committed or active (not depleted/invalid/expired)
  2. Current block >= unlockBlock
  3. Amount matches committed value
  4. Provider must sign

Port layout:
  0 — amount
  1 — unlockBlock
  2 — status
  3 — fee recipient pk hex

## Parameters

### config

[`LiquidityLockConfig`](../interfaces/LiquidityLockConfig.md)

## Returns

`string`
