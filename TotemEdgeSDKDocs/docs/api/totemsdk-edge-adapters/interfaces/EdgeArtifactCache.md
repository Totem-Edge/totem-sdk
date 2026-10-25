[**@totemsdk/edge-adapters**](../index.md)

***

[@totemsdk/edge-adapters](../index.md) / EdgeArtifactCache

# Interface: EdgeArtifactCache

## Properties

### capabilities

> `readonly` **capabilities**: `ArtifactBackendCapabilities`

***

### effective

> `readonly` **effective**: `EffectivePersistence`

Reported after assertPersistence(); callers must never assume durability.

## Methods

### get()

> **get**(`scope`, `ref`, `policy?`): `Promise`\<`ArtifactRead`\>

#### Parameters

##### scope

`StorageScope`

##### ref

`ArtifactRef`

##### policy?

[`ArtifactCacheRetentionPolicy`](ArtifactCacheRetentionPolicy.md)

#### Returns

`Promise`\<`ArtifactRead`\>

***

### invalidate()

> **invalidate**(`scope`, `ref`): `Promise`\<`void`\>

#### Parameters

##### scope

`StorageScope`

##### ref

`ArtifactRef`

#### Returns

`Promise`\<`void`\>

***

### put()

> **put**(`scope`, `bytes`, `policy?`): `Promise`\<`ArtifactRef`\>

#### Parameters

##### scope

`StorageScope`

##### bytes

`Uint8Array`

##### policy?

[`ArtifactCacheRetentionPolicy`](ArtifactCacheRetentionPolicy.md)

#### Returns

`Promise`\<`ArtifactRef`\>
