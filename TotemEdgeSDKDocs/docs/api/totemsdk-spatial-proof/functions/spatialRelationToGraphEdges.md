[**@totemsdk/spatial-proof**](../index.md)

***

[@totemsdk/spatial-proof](../index.md) / spatialRelationToGraphEdges

# Function: spatialRelationToGraphEdges()

> **spatialRelationToGraphEdges**(`claim`): `ProofGraphEdge`[]

Build ProofGraphEdges for a spatial relation claim:
  about       relation → subject
  references  relation → spatial object
  derived_from relation → location claim (when present)
  references  relation → subject proof (when present)
  references  relation → raster manifest (when present)

Edge IDs are deterministic (content-derived in @totemsdk/proofgraph).

## Parameters

### claim

[`SpatialRelationClaim`](../interfaces/SpatialRelationClaim.md)

## Returns

`ProofGraphEdge`[]
