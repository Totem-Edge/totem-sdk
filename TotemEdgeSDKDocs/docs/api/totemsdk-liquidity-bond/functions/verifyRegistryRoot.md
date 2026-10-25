[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / verifyRegistryRoot

# Function: verifyRegistryRoot()

> **verifyRegistryRoot**(`registry`, `root`, `signature`, `verifier`, `opts?`): `Promise`\<`boolean`\>

Verify a root against a registry (boolean form of the transition check):
 1. recompute the root from the registry and require it to equal `root`;
 2. require the verifier to actually check the signature (AUD-015 — no
    structure-only acceptance).

## Parameters

### registry

[`LiquidityBondRegistryState`](../interfaces/LiquidityBondRegistryState.md)

### root

`string`

### signature

`Uint8Array`

### verifier

[`RegistryRootVerifier`](../interfaces/RegistryRootVerifier.md)

### opts?

[`RegistryRootOptions`](../interfaces/RegistryRootOptions.md)

## Returns

`Promise`\<`boolean`\>
