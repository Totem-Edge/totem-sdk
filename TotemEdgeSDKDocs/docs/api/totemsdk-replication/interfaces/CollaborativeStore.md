[**@totemsdk/replication**](../index.md)

***

[@totemsdk/replication](../index.md) / CollaborativeStore

# Interface: CollaborativeStore\<Op, State\>

## Type Parameters

### Op

`Op`

### State

`State`

## Methods

### close()

> **close**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### propose()

> **propose**(`operation`): `Promise`\<\{ `id`: `string`; `status`: `"queued"` \| `"applied"`; \}\>

#### Parameters

##### operation

`Op`

#### Returns

`Promise`\<\{ `id`: `string`; `status`: `"queued"` \| `"applied"`; \}\>

***

### readView()

> **readView**(): `Promise`\<\{ `complete`: `boolean`; `revision`: `string`; `state`: `State`; \}\>

#### Returns

`Promise`\<\{ `complete`: `boolean`; `revision`: `string`; `state`: `State`; \}\>

***

### status()

> **status**(): [`ReplicationStatus`](ReplicationStatus.md)

#### Returns

[`ReplicationStatus`](ReplicationStatus.md)
