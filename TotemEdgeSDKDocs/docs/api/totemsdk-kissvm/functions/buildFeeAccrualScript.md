[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / buildFeeAccrualScript

# Function: buildFeeAccrualScript()

> **buildFeeAccrualScript**(`config`): `string`

Build a fee accrual script that enforces:
  1. Fee accrual is within the window: startBlock <=

## Parameters

### config

[`LiquidityLockConfig`](../interfaces/LiquidityLockConfig.md)

## Returns

`string`

## BLOCK

<= endBlock
  2. Fee = rate * elapsed / totalPeriod (pro-rata)
  3. Claimable = accrued - prevClaimed (no double claim)
  4. Fee goes to governance/fee recipient

Port layout (same coin, higher ports for fee data):
  10 — fee start block
  11 — fee end block
  12 — fee accrued so far
  13 — rate (amount per period)
