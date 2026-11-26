[**@totemsdk/replication-holepunch**](../index.md)

***

[@totemsdk/replication-holepunch](../index.md) / AutobaseCollaborativeOptions

# Interface: AutobaseCollaborativeOptions\<Op, State\>

## Type Parameters

### Op

`Op`

### State

`State`

## Properties

### bootstrapKey?

> `optional` **bootstrapKey?**: `Uint8Array`\<`ArrayBufferLike`\>

Existing base key; omitted creates a new base.

***

### connectedPeers?

> `optional` **connectedPeers?**: () => `number`

Optional live peer count provider.

#### Returns

`number`

***

### datasetVersion

> **datasetVersion**: `number`

***

### isWriterAllowed?

> `optional` **isWriterAllowed?**: (`writerKey`) => `boolean`

Optional allow-list applied to every writer node.

#### Parameters

##### writerKey

`string`

#### Returns

`boolean`

***

### ownerKey?

> `optional` **ownerKey?**: `string`

Writer allowed to add/remove writers; defaults to the local key for a new base.

***

### ownsStore?

> `optional` **ownsStore?**: `boolean`

Close the injected Corestore (default true).

***

### reducer

> **reducer**: [`AutobaseReducer`](AutobaseReducer.md)\<`Op`, `State`\>

***

### storagePath

> **storagePath**: `string`
