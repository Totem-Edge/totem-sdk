[**@totemsdk/pubsub-transport**](../index.md)

***

[@totemsdk/pubsub-transport](../index.md) / IPubSubTransport

# Interface: IPubSubTransport

Canonical publish-subscribe transport interface.

Modelled on MQTT semantics but transport-agnostic:
  - connect/disconnect — lifecycle
  - subscribe/publish  — message exchange
  - onMessage          — global inbound handler (returns unsubscribe fn)

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

> **subscribe**(`topic`): `Promise`\<[`PubSubSubscription`](PubSubSubscription.md)\>

#### Parameters

##### topic

`string`

#### Returns

`Promise`\<[`PubSubSubscription`](PubSubSubscription.md)\>
