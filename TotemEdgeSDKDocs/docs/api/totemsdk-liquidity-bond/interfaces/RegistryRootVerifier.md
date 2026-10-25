[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / RegistryRootVerifier

# Interface: RegistryRootVerifier

Verifier used to check a registry root signature.

`verify` is **required** (AUD-015): an optional verifier let a caller pass an
object with no `verify` and have every signature silently accepted.

## Properties

### publicKeyDigest

> **publicKeyDigest**: `string`

## Methods

### verify()

> **verify**(`payload`, `signature`, `indices?`): `boolean` \| `Promise`\<`boolean`\>

#### Parameters

##### payload

`Uint8Array`

##### signature

`Uint8Array`

##### indices?

`SigningIndices`

#### Returns

`boolean` \| `Promise`\<`boolean`\>
