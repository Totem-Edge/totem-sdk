[**@totemsdk/replication-holepunch**](../index.md)

***

[@totemsdk/replication-holepunch](../index.md) / ReplicatedManifestStore

# Class: ReplicatedManifestStore

## Constructors

### Constructor

> **new ReplicatedManifestStore**(`index`): `ReplicatedManifestStore`

#### Parameters

##### index

[`ManifestIndexPort`](../interfaces/ManifestIndexPort.md)

#### Returns

`ReplicatedManifestStore`

## Methods

### get()

> **get**\<`T`\>(`manifestId`): `Promise`\<[`ReplicatedManifest`](../interfaces/ReplicatedManifest.md)\<`T`\> \| `null`\>

#### Type Parameters

##### T

`T`

#### Parameters

##### manifestId

`string`

#### Returns

`Promise`\<[`ReplicatedManifest`](../interfaces/ReplicatedManifest.md)\<`T`\> \| `null`\>

***

### publish()

> **publish**\<`T`\>(`manifestId`, `version`, `body`): `Promise`\<[`ReplicatedManifest`](../interfaces/ReplicatedManifest.md)\<`T`\>\>

#### Type Parameters

##### T

`T`

#### Parameters

##### manifestId

`string`

##### version

`number`

##### body

`T`

#### Returns

`Promise`\<[`ReplicatedManifest`](../interfaces/ReplicatedManifest.md)\<`T`\>\>
