[**@totemsdk/replication-holepunch**](../index.md)

***

[@totemsdk/replication-holepunch](../index.md) / AutobaseCollaborativeStore

# Class: AutobaseCollaborativeStore\<Op, State\>

## Type Parameters

### Op

`Op`

### State

`State`

## Implements

- `CollaborativeStore`\<`Op`, `State`\>

## Accessors

### baseKey

#### Get Signature

> **get** **baseKey**(): `string`

##### Returns

`string`

***

### localKey

#### Get Signature

> **get** **localKey**(): `string`

##### Returns

`string`

***

### writable

#### Get Signature

> **get** **writable**(): `boolean`

##### Returns

`boolean`

## Methods

### ack()

> **ack**(): `Promise`\<`void`\>

Explicit indexer acknowledgement; completeness is never advanced implicitly.

#### Returns

`Promise`\<`void`\>

***

### addWriter()

> **addWriter**(`writerKey`): `Promise`\<`void`\>

Owner-only writer admission; the control op itself is not materialised.

#### Parameters

##### writerKey

`string`

#### Returns

`Promise`\<`void`\>

***

### close()

> **close**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

#### Implementation of

`CollaborativeStore.close`

***

### materialize()

> **materialize**(`index`, `key?`): `Promise`\<\{ `complete`: `boolean`; `revision`: `string`; `state`: `State`; \}\>

Materialise the current reduced view into a replicated index (for example
`HyperbeeDistributedIndex`). The index is a derived cache; the Autobase
operation log remains authoritative.

#### Parameters

##### index

###### put

##### key?

`string` = `'collab:state'`

#### Returns

`Promise`\<\{ `complete`: `boolean`; `revision`: `string`; `state`: `State`; \}\>

***

### propose()

> **propose**(`operation`): `Promise`\<\{ `id`: `string`; `status`: `"queued"` \| `"applied"`; \}\>

#### Parameters

##### operation

`Op`

#### Returns

`Promise`\<\{ `id`: `string`; `status`: `"queued"` \| `"applied"`; \}\>

#### Implementation of

`CollaborativeStore.propose`

***

### readView()

> **readView**(): `Promise`\<\{ `complete`: `boolean`; `revision`: `string`; `state`: `State`; \}\>

#### Returns

`Promise`\<\{ `complete`: `boolean`; `revision`: `string`; `state`: `State`; \}\>

#### Implementation of

`CollaborativeStore.readView`

***

### removeWriter()

> **removeWriter**(`writerKey`): `Promise`\<`void`\>

Owner-only writer removal (the last indexer cannot be removed).

#### Parameters

##### writerKey

`string`

#### Returns

`Promise`\<`void`\>

***

### replicate()

> **replicate**(`isInitiator?`): `any`

Replication stream for a Corestore connection.

#### Parameters

##### isInitiator?

`boolean` = `false`

#### Returns

`any`

***

### status()

> **status**(): `ReplicationStatus`

#### Returns

`ReplicationStatus`

#### Implementation of

`CollaborativeStore.status`

***

### open()

> `static` **open**\<`Op`, `State`\>(`options`): `Promise`\<`AutobaseCollaborativeStore`\<`Op`, `State`\>\>

#### Type Parameters

##### Op

`Op`

##### State

`State`

#### Parameters

##### options

[`AutobaseCollaborativeOptions`](../interfaces/AutobaseCollaborativeOptions.md)\<`Op`, `State`\>

#### Returns

`Promise`\<`AutobaseCollaborativeStore`\<`Op`, `State`\>\>
