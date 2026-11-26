[**@totemsdk/replication-holepunch**](../index.md)

***

[@totemsdk/replication-holepunch](../index.md) / DownloadModelAssetOptions

# Interface: DownloadModelAssetOptions

## Properties

### download

> **download**: () => `Promise`\<`string`\>

Awaited QVAC `downloadAsset(...)` result (local path or URL).

#### Returns

`Promise`\<`string`\>

***

### expectedRef?

> `optional` **expectedRef?**: `ArtifactRef`

Expected content address. When supplied the bytes must hash to it before
anything is written; a mismatch throws `StorageError('corrupt')`.

***

### namespace

> **namespace**: `string`

Artifact namespace, e.g. `totem-qvac-models`.

***

### readBytes

> **readBytes**: (`location`) => `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Reads the bytes at the returned location.

#### Parameters

##### location

`string`

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

***

### store

> **store**: [`ArtifactStorePort`](ArtifactStorePort.md)

Writable artifact store that owns the bytes.
