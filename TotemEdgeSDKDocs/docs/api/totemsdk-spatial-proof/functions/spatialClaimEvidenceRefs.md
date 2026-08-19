[**@totemsdk/spatial-proof**](../index.md)

***

[@totemsdk/spatial-proof](../index.md) / spatialClaimEvidenceRefs

# Function: spatialClaimEvidenceRefs()

> **spatialClaimEvidenceRefs**(`claim`, `obj`, `subjectGeometry?`): `EvidenceRef`[]

Build the evidence ref list for a spatial proof.

Always includes the relation claim hash and spatial object hash. Optionally
adds the subject geometry hash, subject proof ID, location claim ID, and
raster manifest ID when present on the claim.

## Parameters

### claim

[`SpatialRelationClaim`](../interfaces/SpatialRelationClaim.md)

### obj

[`SpatialObject`](../interfaces/SpatialObject.md)

### subjectGeometry?

[`GeoGeometry`](../type-aliases/GeoGeometry.md)

## Returns

`EvidenceRef`[]
