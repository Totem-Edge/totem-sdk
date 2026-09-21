[**@totemsdk/omnia-pool**](../index.md)

***

[@totemsdk/omnia-pool](../index.md) / claimFees

# Function: claimFees()

> **claimFees**(`pool`, `position`, `registry`, `opts`): `object`

Claim accrued LP fees. The claim is bound to a settled payout (`payoutRef`):
the LP fee balance is only reduced once a real payout (VTXO mint / channel
settlement) exists — preventing "claim then fail to pay" and double-claim.

## Parameters

### pool

`LiquidityPoolManifest`

### position

`LiquidityPosition`

### registry

`LiquidityBondRegistryState`

### opts

[`ClaimFeesOptions`](../interfaces/ClaimFeesOptions.md)

## Returns

`object`

### claimedAmount

> **claimedAmount**: `bigint`

### registry

> **registry**: `LiquidityBondRegistryState`
