[**@totemsdk/identity**](../index.md)

***

[@totemsdk/identity](../index.md) / verifyManifestIdentity

# Function: verifyManifestIdentity()

> **verifyManifestIdentity**(`signedManifest`, `identityGraph`, `options?`): `Promise`\<[`ManifestIdentityBinding`](../interfaces/ManifestIdentityBinding.md)\>

## Parameters

### signedManifest

`SignedManifest`\<`any`\>

### identityGraph

[`IdentityGraph`](../interfaces/IdentityGraph.md)

### options?

#### asOf?

`number`

Explicit resolution time. Defaults to Date.now() for compatibility.

#### proofVerifiers?

`Record`\<`string`, [`IdentityProofVerifier`](../interfaces/IdentityProofVerifier.md)\>

## Returns

`Promise`\<[`ManifestIdentityBinding`](../interfaces/ManifestIdentityBinding.md)\>
