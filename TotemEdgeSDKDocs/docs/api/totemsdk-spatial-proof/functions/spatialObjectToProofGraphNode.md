[**@totemsdk/spatial-proof**](../index.md)

***

[@totemsdk/spatial-proof](../index.md) / spatialObjectToProofGraphNode

# Function: spatialObjectToProofGraphNode()

> **spatialObjectToProofGraphNode**(`obj`): `ProofGraphNode`

Build a ProofGraphNode for a spatial object.

Uses the 'custom' node type (no native proofgraph node type fits a spatial
object). Node ID is deterministic: "custom:<spatialId>".

## Parameters

### obj

[`SpatialObject`](../interfaces/SpatialObject.md)

## Returns

`ProofGraphNode`
