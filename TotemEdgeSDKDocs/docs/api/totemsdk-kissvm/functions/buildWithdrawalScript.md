[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / buildWithdrawalScript

# Function: buildWithdrawalScript()

> **buildWithdrawalScript**(`config`): `string`

Build a withdrawal script that enforces:
  1. Status is quiescing or active (not locked)
  2. Current block >= unlockBlock
  3. Provider must sign
  4. Output must be a valid withdrawal (LP receives funds)
  5. Withdrawal count tracked (max 10)

Port layout:
  0 — amount
  1 — unlockBlock
  2 — status
  3 — fee recipient pk hex
  4 — withdrawal count

## Parameters

### config

[`LiquidityLockConfig`](../interfaces/LiquidityLockConfig.md)

## Returns

`string`
