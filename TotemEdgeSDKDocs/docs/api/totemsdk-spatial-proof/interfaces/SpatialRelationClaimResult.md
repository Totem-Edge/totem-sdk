[**@totemsdk/spatial-proof**](../index.md)

***

[@totemsdk/spatial-proof](../index.md) / SpatialRelationClaimResult

# Interface: SpatialRelationClaimResult

## Properties

### confidenceScore?

> `optional` **confidenceScore?**: `number`

***

### distanceM?

> `optional` **distanceM?**: `number`

***

### matched

> **matched**: `boolean`

***

### uncertainty?

> `optional` **uncertainty?**: `string`[]

Explicit notes on approximation. Present whenever a relation was
evaluated with an approximate algorithm (e.g. bbox-only). Honesty is
critical — the package never silently claims exactness.
