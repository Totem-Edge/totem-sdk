[**@totemsdk/replication-holepunch**](../index.md)

***

[@totemsdk/replication-holepunch](../index.md) / HyperdriveArtifactBackend

# Class: HyperdriveArtifactBackend

## Implements

- `ArtifactStoreBackend`

## Properties

### capabilities

> `readonly` **capabilities**: `ArtifactBackendCapabilities`

#### Implementation of

`ArtifactStoreBackend.capabilities`

## Accessors

### raw

#### Get Signature

> **get** **raw**(): `any`

##### Returns

`any`

## Methods

### close()

> **close**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### get()

> **get**(`ref`): `Promise`\<`ArtifactRead`\>

#### Parameters

##### ref

`ArtifactRef`

#### Returns

`Promise`\<`ArtifactRead`\>

#### Implementation of

`ArtifactStoreBackend.get`

***

### put()

> **put**(`ref`, `bytes`, `_options?`): `Promise`\<`PutReceipt`\>

#### Parameters

##### ref

`ArtifactRef`

##### bytes

`Uint8Array`

##### \_options?

`PutOptions`

#### Returns

`Promise`\<`PutReceipt`\>

#### Implementation of

`ArtifactStoreBackend.put`

***

### open()

> `static` **open**(`options`): `Promise`\<`HyperdriveArtifactBackend`\>

#### Parameters

##### options

[`HyperdriveArtifactOptions`](../interfaces/HyperdriveArtifactOptions.md)

#### Returns

`Promise`\<`HyperdriveArtifactBackend`\>
