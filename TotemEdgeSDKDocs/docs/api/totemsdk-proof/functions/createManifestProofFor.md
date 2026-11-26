[**@totemsdk/proof**](../index.md)

***

[@totemsdk/proof](../index.md) / createManifestProofFor

# Function: createManifestProofFor()

> **createManifestProofFor**(`signedManifest`, `params`): [`UnsignedProof`](../interfaces/UnsignedProof.md)

Build a manifest proof whose id is derived from the manifest itself, so it
cannot be created with a mismatched id by accident.

## Parameters

### signedManifest

`SignedManifest`\<`any`\>

### params

`Omit`\<[`CreateManifestProofParams`](../interfaces/CreateManifestProofParams.md), `"issuer"` \| `"manifestId"`\> & `object`

## Returns

[`UnsignedProof`](../interfaces/UnsignedProof.md)
