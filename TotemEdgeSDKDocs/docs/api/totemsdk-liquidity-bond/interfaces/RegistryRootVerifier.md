[**@totemsdk/liquidity-bond**](../index.md)

***

[@totemsdk/liquidity-bond](../index.md) / RegistryRootVerifier

# Interface: RegistryRootVerifier

Verifier used to check a registry root signature.

## Properties

### publicKeyDigest

> **publicKeyDigest**: `string`

## Methods

### verify()?

> `optional` **verify**(`payload`, `signature`, `indices?`): `boolean` \| `Promise`\<`boolean`\>

#### Parameters

##### payload

`Uint8Array`

##### signature

`Uint8Array`

##### indices?

`SigningIndices`

#### Returns

`boolean` \| `Promise`\<`boolean`\>
