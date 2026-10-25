[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / verifyRegistryTransition

# Function: verifyRegistryTransition()

> **verifyRegistryTransition**(`registry`, `transition`, `verifier`, `opts?`): `Promise`\<\{ `reasons`: `string`[]; `valid`: `boolean`; \}\>

Root-based transition verification (#6): recompute root, then always check
the signature over the transition payload (anchor + sequence + op) and the
signer identity. A verifier without `verify` fails closed (AUD-015).

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
