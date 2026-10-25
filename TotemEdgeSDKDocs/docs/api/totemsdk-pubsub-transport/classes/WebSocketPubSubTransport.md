[**@totemsdk/pubsub-transport**](../index.md)

***

[@totemsdk/pubsub-transport](../index.md) / WebSocketPubSubTransport

# Class: WebSocketPubSubTransport

Browser/native client for a local P2P hub. Implements `IPubSubTransport`
over a WebSocket JSON protocol (see `HubClientFrame`/`HubServerFrame`).

The transport intentionally does not auto-reconnect; the caller should
recreate/connect on close and re-subscribe.

## Implements

- [`IPubSubTransport`](../interfaces/IPubSubTransport.md)

## Constructors

### Constructor

> **new WebSocketPubSubTransport**(`options`): `WebSocketPubSubTransport`

#### Parameters

##### options

[`WebSocketPubSubOptions`](../interfaces/WebSocketPubSubOptions.md)

#### Returns

`WebSocketPubSubTransport`

## Accessors

### connected

#### Get Signature

> **get** **connected**(): `boolean`

##### Returns

`boolean`

## Methods

### connect()

> **connect**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IPubSubTransport`](../interfaces/IPubSubTransport.md).[`connect`](../interfaces/IPubSubTransport.md#connect)

***

### disconnect()

> **disconnect**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`IPubSubTransport`](../interfaces/IPubSubTransport.md).[`disconnect`](../interfaces/IPubSubTransport.md#disconnect)

***

### onMessage()

> **onMessage**(`handler`): () => `void`

#### Parameters

##### handler

(`message`) => `void`

#### Returns

() => `void`

#### Implementation of

[`IPubSubTransport`](../interfaces/IPubSubTransport.md).[`onMessage`](../interfaces/IPubSubTransport.md#onmessage)

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

#### Implementation of

[`IPubSubTransport`](../interfaces/IPubSubTransport.md).[`publish`](../interfaces/IPubSubTransport.md#publish)

***

### subscribe()

> **subscribe**(`topic`): `Promise`\<[`PubSubSubscription`](../interfaces/PubSubSubscription.md)\>

#### Parameters

##### topic

`string`

#### Returns

`Promise`\<[`PubSubSubscription`](../interfaces/PubSubSubscription.md)\>

#### Implementation of

[`IPubSubTransport`](../interfaces/IPubSubTransport.md).[`subscribe`](../interfaces/IPubSubTransport.md#subscribe)
