[**@totemsdk/recursive-mast**](../index.md)

***

[@totemsdk/recursive-mast](../index.md) / signPolicyManifest

# Function: signPolicyManifest()

> **signPolicyManifest**(`manifest`, `signFn`, `authorityPkd`): `Promise`\<[`RecursiveMastPolicyManifest`](../interfaces/RecursiveMastPolicyManifest.md)\>

Sign a policy manifest with the authority's key.

## Parameters

### manifest

`Omit`\<[`RecursiveMastPolicyManifest`](../interfaces/RecursiveMastPolicyManifest.md), `"authoritySignature"` \| `"authorityPkd"` \| `"signedAt"`\>

### signFn

(`data`) => `Uint8Array`\<`ArrayBufferLike`\> \| `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

### authorityPkd

`string`

## Returns

`Promise`\<[`RecursiveMastPolicyManifest`](../interfaces/RecursiveMastPolicyManifest.md)\>
