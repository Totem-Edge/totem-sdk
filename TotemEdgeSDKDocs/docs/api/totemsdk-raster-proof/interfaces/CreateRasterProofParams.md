[**@totemsdk/raster-proof**](../index.md)

***

[@totemsdk/raster-proof](../index.md) / CreateRasterProofParams

# Interface: CreateRasterProofParams

## Properties

### expiresAt?

> `optional` **expiresAt?**: `number`

***

### issuedAt?

> `optional` **issuedAt?**: `number`

***

### issuer?

> `optional` **issuer?**: `string`

***

### manifest

> **manifest**: [`RasterManifest`](RasterManifest.md)

***

### merkleProofs?

> `optional` **merkleProofs?**: [`RasterMerkleProof`](RasterMerkleProof.md)[]

Full Merkle proofs for chunks referenced by windowProof (optional, enables leaf-level verification).

***

### spatialObjectId?

> `optional` **spatialObjectId?**: `string`

Spatial object ID referenced by the raster footprint (added as evidence ref).

***

### windowProof?

> `optional` **windowProof?**: [`RasterWindowProof`](RasterWindowProof.md)
