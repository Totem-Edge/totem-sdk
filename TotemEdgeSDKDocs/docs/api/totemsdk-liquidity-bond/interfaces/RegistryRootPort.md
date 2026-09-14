[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / RegistryRootPort

# Interface: RegistryRootPort

A channel program can carry a `RegistryRootPort` so an on-chain program can
recompute/verify the pool anchor without pulling the full registry in.

## Methods

### applyRegistryTransition()

> **applyRegistryTransition**(`state`, `next`, `transition`, `verifier`, `opts?`): `Promise`\<[`LiquidityBondRegistryState`](LiquidityBondRegistryState.md)\>

#### Parameters

##### state

[`LiquidityBondRegistryState`](LiquidityBondRegistryState.md)

##### next

[`LiquidityBondRegistryState`](LiquidityBondRegistryState.md)

##### transition

[`RegistrySignedTransition`](RegistrySignedTransition.md)

##### verifier

[`RegistryRootVerifier`](RegistryRootVerifier.md)

##### opts?

[`RegistryRootOptions`](RegistryRootOptions.md)

#### Returns

`Promise`\<[`LiquidityBondRegistryState`](LiquidityBondRegistryState.md)\>

***

### computeRegistryRoot()

> **computeRegistryRoot**(`registry`, `opts?`): `string`

#### Parameters

##### registry

[`LiquidityBondRegistryState`](LiquidityBondRegistryState.md)

##### opts?

[`RegistryRootOptions`](RegistryRootOptions.md)

#### Returns

`string`

***

### serializeRegistryState()

> **serializeRegistryState**(`registry`): `string`

#### Parameters

##### registry

[`LiquidityBondRegistryState`](LiquidityBondRegistryState.md)

#### Returns

`string`

***

### signRegistryTransition()

> **signRegistryTransition**(`registry`, `op`, `signer`, `opts?`): `Promise`\<[`RegistrySignedTransition`](RegistrySignedTransition.md)\>

#### Parameters

##### registry

[`LiquidityBondRegistryState`](LiquidityBondRegistryState.md)

##### op

[`RegistryOperation`](RegistryOperation.md)

##### signer

[`RegistryTransitionSigner`](RegistryTransitionSigner.md)

##### opts?

[`RegistryRootOptions`](RegistryRootOptions.md)

#### Returns

`Promise`\<[`RegistrySignedTransition`](RegistrySignedTransition.md)\>

***

### verifyRegistryTransition()

> **verifyRegistryTransition**(`registry`, `transition`, `verifier`, `opts?`): `Promise`\<\{ `reasons`: `string`[]; `valid`: `boolean`; \}\>

#### Parameters

##### registry

[`LiquidityBondRegistryState`](LiquidityBondRegistryState.md)

##### transition

[`RegistrySignedTransition`](RegistrySignedTransition.md)

##### verifier

[`RegistryRootVerifier`](RegistryRootVerifier.md)

##### opts?

[`RegistryRootOptions`](RegistryRootOptions.md)

#### Returns

`Promise`\<\{ `reasons`: `string`[]; `valid`: `boolean`; \}\>
