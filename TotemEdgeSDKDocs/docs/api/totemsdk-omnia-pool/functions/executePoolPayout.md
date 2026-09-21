[**@totemsdk/omnia-pool**](../index.md)

***

[@totemsdk/omnia-pool](../index.md) / executePoolPayout

# Function: executePoolPayout()

> **executePoolPayout**(`params`, `registry`): `Promise`\<\{ `execution?`: `unknown`; `intent`: `WithdrawalIntent`; `position`: `LiquidityPosition`; `registry`: `LiquidityBondRegistryState`; `signedTransition?`: `RegistrySignedTransition`; \}\>

Execute a payout for an approved withdrawal intent.
For VTXO-backed positions this creates an exit draft; for channel-backed
positions it requests a settlement payload. Pure-record positions return the
intent only and expect the caller to handle settlement externally.

## Parameters

### params

`ExecutePoolPayoutParams`

### registry

`LiquidityBondRegistryState`

## Returns

`Promise`\<\{ `execution?`: `unknown`; `intent`: `WithdrawalIntent`; `position`: `LiquidityPosition`; `registry`: `LiquidityBondRegistryState`; `signedTransition?`: `RegistrySignedTransition`; \}\>
