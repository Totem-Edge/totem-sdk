[**@totemsdk/storage**](../index.md)

***

[@totemsdk/storage](../index.md) / ArtifactStore

# Class: ArtifactStore

## Constructors

### Constructor

> **new ArtifactStore**(`backend`, `options?`): `ArtifactStore`

#### Parameters

##### backend

[`ArtifactStoreBackend`](../interfaces/ArtifactStoreBackend.md)

##### options?

`ArtifactStoreOptions` = `{}`

#### Returns

`ArtifactStore`

## Accessors

### capabilities

#### Get Signature

> **get** **capabilities**(): [`ArtifactBackendCapabilities`](../interfaces/ArtifactBackendCapabilities.md)

##### Returns

[`ArtifactBackendCapabilities`](../interfaces/ArtifactBackendCapabilities.md)

## Methods

### delete()

> **delete**(`ref`): `Promise`\<`void`\>

#### Parameters

##### ref

[`ArtifactRef`](../interfaces/ArtifactRef.md)

#### Returns

`Promise`\<`void`\>

***

### get()

> **get**(`ref`): `Promise`\<[`ArtifactRead`](../interfaces/ArtifactRead.md)\>

#### Parameters

##### ref

[`ArtifactRef`](../interfaces/ArtifactRef.md)

#### Returns

`Promise`\<[`ArtifactRead`](../interfaces/ArtifactRead.md)\>

***

### list()

> **list**(): `Promise`\<[`ArtifactIndexEntry`](../interfaces/ArtifactIndexEntry.md)[]\>

#### Returns

`Promise`\<[`ArtifactIndexEntry`](../interfaces/ArtifactIndexEntry.md)[]\>

***

### put()

> **put**(`namespace`, `bytes`, `options?`): `Promise`\<[`PutReceipt`](../interfaces/PutReceipt.md)\>

#### Parameters

##### namespace

`string`

##### bytes

`Uint8Array`

##### options?

[`PutOptions`](../interfaces/PutOptions.md)

#### Returns

`Promise`\<[`PutReceipt`](../interfaces/PutReceipt.md)\>
