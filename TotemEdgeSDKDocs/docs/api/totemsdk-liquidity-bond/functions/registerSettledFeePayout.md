[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / registerSettledFeePayout

# Function: registerSettledFeePayout()

> **registerSettledFeePayout**(`registry`, `params`): `Promise`\<\{ `payout`: [`SettledFeePayout`](../interfaces/SettledFeePayout.md); `registry`: [`LiquidityBondRegistryState`](../interfaces/LiquidityBondRegistryState.md); \}\>

Record a payout as settled, bound to the exact position, pool, LP and amount.
Registration requires a live settlement verifier: an unverified reference can
never become a payout that a fee claim/compound is allowed to release. The
reference is unique — a reused payoutId/nonce is rejected.

## Parameters

### registry

[`LiquidityBondRegistryState`](../interfaces/LiquidityBondRegistryState.md)

### params

[`RegisterSettledFeePayoutParams`](../interfaces/RegisterSettledFeePayoutParams.md)

## Returns

`Promise`\<\{ `payout`: [`SettledFeePayout`](../interfaces/SettledFeePayout.md); `registry`: [`LiquidityBondRegistryState`](../interfaces/LiquidityBondRegistryState.md); \}\>
