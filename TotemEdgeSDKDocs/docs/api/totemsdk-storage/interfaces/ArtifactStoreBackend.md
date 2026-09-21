[**@totemsdk/storage**](../index.md)

***

[@totemsdk/storage](../index.md) / ArtifactStoreBackend

# Interface: ArtifactStoreBackend

## Properties

### capabilities

> `readonly` **capabilities**: [`ArtifactBackendCapabilities`](ArtifactBackendCapabilities.md)

## Methods

### delete()?

> `optional` **delete**(`ref`): `Promise`\<`void`\>

#### Parameters

##### ref

[`ArtifactRef`](ArtifactRef.md)

#### Returns

`Promise`\<`void`\>

***

### get()

> **get**(`ref`): `Promise`\<[`ArtifactRead`](ArtifactRead.md)\>

#### Parameters

##### ref

[`ArtifactRef`](ArtifactRef.md)

#### Returns

`Promise`\<[`ArtifactRead`](ArtifactRead.md)\>

***

### put()

> **put**(`ref`, `bytes`, `options?`): `Promise`\<[`PutReceipt`](PutReceipt.md)\>

#### Parameters

##### ref

[`ArtifactRef`](ArtifactRef.md)

##### bytes

`Uint8Array`

##### options?

[`PutOptions`](PutOptions.md)

#### Returns

`Promise`\<[`PutReceipt`](PutReceipt.md)\>
