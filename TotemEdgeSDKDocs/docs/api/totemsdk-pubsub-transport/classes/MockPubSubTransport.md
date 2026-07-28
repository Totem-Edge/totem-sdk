[**@totemsdk/pubsub-transport**](../index.md)

***

[@totemsdk/pubsub-transport](../index.md) / MockPubSubTransport

# Class: MockPubSubTransport

Mock pub/sub transport for unit tests.
Records all published messages and supports manual message injection.

## Implements

- [`IPubSubTransport`](../interfaces/IPubSubTransport.md)

## Constructors

### Constructor

> **new MockPubSubTransport**(): `MockPubSubTransport`

#### Returns

`MockPubSubTransport`

## Properties

### connected

> **connected**: `boolean` = `false`

***

### published

> `readonly` **published**: `object`[] = `[]`

#### payload

> **payload**: `string` \| `Uint8Array`\<`ArrayBufferLike`\>

#### topic

> **topic**: `string`

***

### subscriptions

> `readonly` **subscriptions**: `string`[] = `[]`

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

### inject()

> **inject**(`topic`, `payload`): `void`

Inject an inbound message — useful for simulating broker delivery in tests.

#### Parameters

##### topic

`string`

##### payload

`string` \| `Uint8Array`\<`ArrayBufferLike`\>

#### Returns

`void`

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
