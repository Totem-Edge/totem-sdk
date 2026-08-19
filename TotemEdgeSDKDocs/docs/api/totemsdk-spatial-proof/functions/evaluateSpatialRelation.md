[**@totemsdk/spatial-proof**](../index.md)

***

[@totemsdk/spatial-proof](../index.md) / evaluateSpatialRelation

# Function: evaluateSpatialRelation()

> **evaluateSpatialRelation**(`params`): [`SpatialRelationClaim`](../interfaces/SpatialRelationClaim.md)

Evaluate a spatial relation and return a deterministic SpatialRelationClaim.

The claim's relationId is content-derived from all fields except relationId
and metadata, so identical evaluations always produce the same ID.

## Parameters

### params

[`EvaluateSpatialRelationParams`](../interfaces/EvaluateSpatialRelationParams.md)

## Returns

[`SpatialRelationClaim`](../interfaces/SpatialRelationClaim.md)
