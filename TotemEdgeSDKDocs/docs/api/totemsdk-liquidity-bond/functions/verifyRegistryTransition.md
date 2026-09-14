[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / verifyRegistryTransition

# Function: verifyRegistryTransition()

> **verifyRegistryTransition**(`registry`, `transition`, `verifier`, `opts?`): `Promise`\<\{ `reasons`: `string`[]; `valid`: `boolean`; \}\>

Root-based transition verification (#6): recompute root, then (when the
verifier exposes `verify`) check the signature and signer identity.

## Parameters

### registry

[`LiquidityBondRegistryState`](../interfaces/LiquidityBondRegistryState.md)

### transition

[`RegistrySignedTransition`](../interfaces/RegistrySignedTransition.md)

### verifier

[`RegistryRootVerifier`](../interfaces/RegistryRootVerifier.md)

### opts?

[`RegistryRootOptions`](../interfaces/RegistryRootOptions.md)

## Returns

`Promise`\<\{ `reasons`: `string`[]; `valid`: `boolean`; \}\>
