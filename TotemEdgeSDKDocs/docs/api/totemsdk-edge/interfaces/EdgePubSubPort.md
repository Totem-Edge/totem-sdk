[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / EdgePubSubPort

# Interface: EdgePubSubPort

Publish-subscribe transport port.

Wraps @totemsdk/pubsub-transport's IPubSubTransport as a first-class
Edge runtime port. Protocol-agnostic — works with MQTT brokers, in-process
event buses, or any pub/sub backend.

## Methods

### connect()

> **connect**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### disconnect()

> **disconnect**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### onMessage()

> **onMessage**(`handler`): () => `void`

#### Parameters

##### handler

(`message`) => `void`

#### Returns

() => `void`

***

### publish()

> **publish**(`topic`, `payload`): `Promise`\<`void`\>

#### Parameters

##### topic

`string`

##### payload

`string` \| `Uint8Array`\<`ArrayBufferLike`\>

#### Returns

`Promise`\<`void`\>

***

### subscribe()

> **subscribe**(`topic`): `Promise`\<\{ `topic`: `string`; `unsubscribe`: `Promise`\<`void`\>; \}\>

#### Parameters

##### topic

`string`

#### Returns

`Promise`\<\{ `topic`: `string`; `unsubscribe`: `Promise`\<`void`\>; \}\>
