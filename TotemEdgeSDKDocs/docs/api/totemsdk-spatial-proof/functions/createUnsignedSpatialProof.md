[**@totemsdk/spatial-proof**](../index.md)

***

[@totemsdk/spatial-proof](../index.md) / createUnsignedSpatialProof

# Function: createUnsignedSpatialProof()

> **createUnsignedSpatialProof**(`params`): `UnsignedProof`

Create an unsigned attestation proof for a spatial relation claim.

The proof claims: "this subject relates to this spatial object in this way
at this time, computed by this engine." It does NOT claim the relation is
geodetically exact — approximation notes travel inside the claim result.

## Parameters

### params

[`CreateSpatialProofParams`](../interfaces/CreateSpatialProofParams.md)

## Returns

`UnsignedProof`
