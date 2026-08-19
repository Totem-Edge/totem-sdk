[**@totemsdk/pubsub-transport**](../index.md)

***

[@totemsdk/pubsub-transport](../index.md) / EventEmitterTransport

# Class: EventEmitterTransport

In-process pub/sub transport backed by a Node.js EventEmitter.
Useful for wiring together components in the same process without a broker.

Two EventEmitterTransport instances sharing the same `bus` EventEmitter
form a bidirectional pub/sub channel: what one publishes, the other receives.

## Implements

- [`IPubSubTransport`](../interfaces/IPubSubTransport.md)

## Constructors

### Constructor

> **new EventEmitterTransport**(`bus?`): `EventEmitterTransport`

#### Parameters

##### bus?

`EventEmitter`\<`DefaultEventMap`\>

#### Returns

`EventEmitterTransport`

## Accessors

### bus

#### Get Signature

> **get** **bus**(): `EventEmitter`

##### Returns

`EventEmitter`

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
