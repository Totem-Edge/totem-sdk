[**@totemsdk/kissvm**](../index.md)

***

[@totemsdk/kissvm](../index.md) / LayeredPolicyConfig

# Interface: LayeredPolicyConfig

## Properties

### assetId

> **assetId**: `string`

Asset root identifier (e.g. device serial, fleet ID, site ID).

***

### assetName

> **assetName**: `string`

Asset root name.

***

### layers

> **layers**: [`PolicyLayer`](PolicyLayer.md)[]

Ordered layers from root to action.

***

### maxDepth?

> `optional` **maxDepth?**: `number`

Optional: maximum allowed depth (default 7).
