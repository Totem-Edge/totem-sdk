[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / changedPoolIds

# Function: changedPoolIds()

> **changedPoolIds**(`state`, `next`): `Set`\<`string`\>

The set of pool ids whose state differs between `state` and `next`
(AUD-014). Used to confine a writer-authorized transition to the pool it
declared in `op.poolId`.

## Parameters

### state

[`LiquidityBondRegistryState`](../interfaces/LiquidityBondRegistryState.md)

### next

[`LiquidityBondRegistryState`](../interfaces/LiquidityBondRegistryState.md)

## Returns

`Set`\<`string`\>
