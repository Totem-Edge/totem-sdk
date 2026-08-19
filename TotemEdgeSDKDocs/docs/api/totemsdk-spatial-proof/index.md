**@totemsdk/spatial-proof**

***

# @totemsdk/spatial-proof

## Interfaces

- [BoundingBox](interfaces/BoundingBox.md)
- [CreateSpatialProofParams](interfaces/CreateSpatialProofParams.md)
- [EngineInfo](interfaces/EngineInfo.md)
- [EvaluateSpatialRelationParams](interfaces/EvaluateSpatialRelationParams.md)
- [GeoLineStringGeometry](interfaces/GeoLineStringGeometry.md)
- [GeoMultiPolygonGeometry](interfaces/GeoMultiPolygonGeometry.md)
- [GeoPointGeometry](interfaces/GeoPointGeometry.md)
- [GeoPolygonGeometry](interfaces/GeoPolygonGeometry.md)
- [SpatialObject](interfaces/SpatialObject.md)
- [SpatialProofVerifyResult](interfaces/SpatialProofVerifyResult.md)
- [SpatialRelationClaim](interfaces/SpatialRelationClaim.md)
- [SpatialRelationClaimInputs](interfaces/SpatialRelationClaimInputs.md)
- [SpatialRelationClaimResult](interfaces/SpatialRelationClaimResult.md)
- [SpatialValidationResult](interfaces/SpatialValidationResult.md)

## Type Aliases

- [Coordinate](type-aliases/Coordinate.md)
- [GeoGeometry](type-aliases/GeoGeometry.md)
- [SpatialObjectKind](type-aliases/SpatialObjectKind.md)
- [SpatialRelationType](type-aliases/SpatialRelationType.md)

## Functions

- [addSpatialRelationToGraph](functions/addSpatialRelationToGraph.md)
- [bboxCovers](functions/bboxCovers.md)
- [bboxIntersects](functions/bboxIntersects.md)
- [canonicalJson](functions/canonicalJson.md)
- [computeGeometryHash](functions/computeGeometryHash.md)
- [computeSpatialObjectId](functions/computeSpatialObjectId.md)
- [computeSpatialRelationId](functions/computeSpatialRelationId.md)
- [createUnsignedSpatialProof](functions/createUnsignedSpatialProof.md)
- [distanceMeters](functions/distanceMeters.md)
- [distancePointToLineStringMeters](functions/distancePointToLineStringMeters.md)
- [distancePointToSegmentMeters](functions/distancePointToSegmentMeters.md)
- [evaluateSpatialRelation](functions/evaluateSpatialRelation.md)
- [getBoundingBox](functions/getBoundingBox.md)
- [hashSpatialObject](functions/hashSpatialObject.md)
- [hashSpatialRelationClaim](functions/hashSpatialRelationClaim.md)
- [isPointNearBoundary](functions/isPointNearBoundary.md)
- [isRingClosed](functions/isRingClosed.md)
- [normalizePolygon](functions/normalizePolygon.md)
- [normalizePolygonRing](functions/normalizePolygonRing.md)
- [pointInMultiPolygon](functions/pointInMultiPolygon.md)
- [pointInPolygon](functions/pointInPolygon.md)
- [signSpatialProof](functions/signSpatialProof.md)
- [spatialClaimEvidenceRefs](functions/spatialClaimEvidenceRefs.md)
- [spatialObjectToEvidenceRef](functions/spatialObjectToEvidenceRef.md)
- [spatialObjectToProofGraphNode](functions/spatialObjectToProofGraphNode.md)
- [spatialRelationFromLocationClaim](functions/spatialRelationFromLocationClaim.md)
- [spatialRelationToEvidenceRef](functions/spatialRelationToEvidenceRef.md)
- [spatialRelationToGraphEdges](functions/spatialRelationToGraphEdges.md)
- [spatialRelationToProofGraphNode](functions/spatialRelationToProofGraphNode.md)
- [toHex](functions/toHex.md)
- [validateCoordinate](functions/validateCoordinate.md)
- [validateGeometry](functions/validateGeometry.md)
- [validateSpatialObject](functions/validateSpatialObject.md)
- [validateSpatialRelationClaim](functions/validateSpatialRelationClaim.md)
- [verifySpatialProof](functions/verifySpatialProof.md)
