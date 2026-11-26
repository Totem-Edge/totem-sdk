[**@totemsdk/replication-holepunch**](../index.md)

***

[@totemsdk/replication-holepunch](../index.md) / ArtifactStorePort

# Interface: ArtifactStorePort

Structural port so ESM and CJS builds of ArtifactStore share one contract.

## Properties

### capabilities

> `readonly` **capabilities**: `object`

#### writable

> `readonly` **writable**: `boolean`

## Methods

### put()

> **put**(`namespace`, `bytes`): `Promise`\<\{ `ref`: `ArtifactRef`; \}\>

#### Parameters

##### namespace

`string`

##### bytes

`Uint8Array`

#### Returns

`Promise`\<\{ `ref`: `ArtifactRef`; \}\>
