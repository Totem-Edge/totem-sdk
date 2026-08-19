[**@totemsdk/spatial-proof**](../index.md)

***

[@totemsdk/spatial-proof](../index.md) / EvaluateSpatialRelationParams

# Interface: EvaluateSpatialRelationParams

## Properties

### computedAt?

> `optional` **computedAt?**: `number`

***

### locationClaimId?

> `optional` **locationClaimId?**: `string`

***

### maxDistanceM?

> `optional` **maxDistanceM?**: `number`

Required for distance-based relations (within_distance, on_route, near_boundary).

***

### metadata?

> `optional` **metadata?**: `Record`\<`string`, `unknown`\>

***

### rasterManifestId?

> `optional` **rasterManifestId?**: `string`

***

### relation

> **relation**: [`SpatialRelationType`](../type-aliases/SpatialRelationType.md)

***

### spatialObject

> **spatialObject**: [`SpatialObject`](SpatialObject.md)

***

### subjectGeometry?

> `optional` **subjectGeometry?**: [`GeoGeometry`](../type-aliases/GeoGeometry.md)

***

### subjectId

> **subjectId**: `string`

***

### subjectKind

> **subjectKind**: `string`

***

### subjectProofId?

> `optional` **subjectProofId?**: `string`
