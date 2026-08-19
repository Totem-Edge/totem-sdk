[**@totemsdk/raster-proof**](../index.md)

***

[@totemsdk/raster-proof](../index.md) / createUnsignedRasterProof

# Function: createUnsignedRasterProof()

> **createUnsignedRasterProof**(`params`): `UnsignedProof`

Create an unsigned attestation proof for a raster manifest.

The proof claims: "this manifest describes this asset, produced by this
source, at this time, with this content hash / Merkle root". It does NOT
claim the visual interpretation is correct — interpretation is an
operator / model / reviewer claim made elsewhere.

## Parameters

### params

[`CreateRasterProofParams`](../interfaces/CreateRasterProofParams.md)

## Returns

`UnsignedProof`
