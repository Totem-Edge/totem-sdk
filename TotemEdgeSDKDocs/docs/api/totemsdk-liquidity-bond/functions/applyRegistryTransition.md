[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / applyRegistryTransition

# Function: applyRegistryTransition()

> **applyRegistryTransition**(`state`, `next`, `transition`, `verifier`, `opts?`): `Promise`\<[`LiquidityBondRegistryState`](../interfaces/LiquidityBondRegistryState.md)\>

Apply a signed transition to a registry (#6/#34): a mutation is only applied
when its signature verifies, its `previousRoot` extends the registry's current
anchor root, and its `sequence` strictly advances the registry's sequence
(anti-reorg — a `previousRoot` resubmission after a rollback is rejected).
When `writers` is provided, every pool the transition touches must be signed
by that pool's authorized writer. Returns a new state with `root` and
`sequence` advanced. Without this gate anyone could fabricate a
`LiquidityBondRegistryState`.

## Parameters

### state

[`LiquidityBondRegistryState`](../interfaces/LiquidityBondRegistryState.md)

### next

[`LiquidityBondRegistryState`](../interfaces/LiquidityBondRegistryState.md)

### transition

[`RegistrySignedTransition`](../interfaces/RegistrySignedTransition.md)

### verifier

[`RegistryRootVerifier`](../interfaces/RegistryRootVerifier.md)

### opts?

[`RegistryRootOptions`](../interfaces/RegistryRootOptions.md) & `object`

## Returns

`Promise`\<[`LiquidityBondRegistryState`](../interfaces/LiquidityBondRegistryState.md)\>
