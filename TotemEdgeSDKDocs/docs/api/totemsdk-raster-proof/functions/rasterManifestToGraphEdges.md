[**@totemsdk/raster-proof**](../index.md)

***

[@totemsdk/raster-proof](../index.md) / rasterManifestToGraphEdges

# Function: rasterManifestToGraphEdges()

> **rasterManifestToGraphEdges**(`manifest`): `ProofGraphEdge`[]

Build ProofGraphEdges for a raster manifest:
  derived_from  raster → each source raster     (when provenance.derivedFrom)
  references    raster → spatial object         (when spatial.spatialObjectId)
  about         raster → device                 (when deviceId)
  about         raster → subject(operator)      (when operatorId)
  about         raster → subject(mission)       (when missionId)
  references    window proof → raster           (see rasterWindowProofToGraphEdges)

The "raster supports proof" edge is created by @totemsdk/proofgraph's
addProof when the signed proof is added to the graph — this helper has no
proof to link at construction time.

Edge IDs are deterministic (content-derived in @totemsdk/proofgraph).

## Parameters

### manifest

[`RasterManifest`](../interfaces/RasterManifest.md)

## Returns

`ProofGraphEdge`[]
