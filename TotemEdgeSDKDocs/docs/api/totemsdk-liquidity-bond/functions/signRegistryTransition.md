[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / signRegistryTransition

# Function: signRegistryTransition()

> **signRegistryTransition**(`registry`, `op`, `signer`, `opts?`): `Promise`\<[`RegistrySignedTransition`](../interfaces/RegistrySignedTransition.md)\>

Sign a registry transition: binds the resulting state (via `root`), the mutation
(`op`), and the prior anchor (`previousRoot`) into one signed record.

## Parameters

### registry

[`LiquidityBondRegistryState`](../interfaces/LiquidityBondRegistryState.md)

### op

[`RegistryOperation`](../interfaces/RegistryOperation.md)

### signer

[`RegistryTransitionSigner`](../interfaces/RegistryTransitionSigner.md)

### opts?

[`RegistryRootOptions`](../interfaces/RegistryRootOptions.md)

## Returns

`Promise`\<[`RegistrySignedTransition`](../interfaces/RegistrySignedTransition.md)\>
