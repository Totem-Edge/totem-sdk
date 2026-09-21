[**@totemsdk/omnia-pool**](../index.md)

***

[@totemsdk/omnia-pool](../index.md) / depositToPool

# Function: depositToPool()

> **depositToPool**(`params`, `registry`): `Promise`\<[`DepositToPoolResult`](../interfaces/DepositToPoolResult.md)\>

Full deposit flow: commit (declared funding) → verify on-chain → accept →
create position from confirmed funding → issue receipt → anchor the registry
transition. Async because acceptance is an on-chain gate.

## Parameters

### params

`DepositToPoolParams`

### registry

`LiquidityBondRegistryState`

## Returns

`Promise`\<[`DepositToPoolResult`](../interfaces/DepositToPoolResult.md)\>
