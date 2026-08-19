[**@totemsdk/spatial-proof**](../index.md)

***

[@totemsdk/spatial-proof](../index.md) / SpatialRelationClaimInputs

# Interface: SpatialRelationClaimInputs

## Properties

### locationClaimId?

> `optional` **locationClaimId?**: `string`

Optional location claim ID the geometry was derived from.

***

### rasterManifestId?

> `optional` **rasterManifestId?**: `string`

Optional raster/scene manifest ID the geometry was derived from.

***

### spatialGeometryHash

> **spatialGeometryHash**: `string`

totem:geo:<hex> hash of the spatial object's geometry.

***

### subjectGeometryHash?

> `optional` **subjectGeometryHash?**: `string`

totem:geo:<hex> hash of the subject geometry (when supplied).

***

### subjectProofId?

> `optional` **subjectProofId?**: `string`

Optional subject proof ID the geometry was derived from.
