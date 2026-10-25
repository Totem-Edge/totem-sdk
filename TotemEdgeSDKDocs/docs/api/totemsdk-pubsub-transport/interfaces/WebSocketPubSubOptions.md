[**@totemsdk/pubsub-transport**](../index.md)

***

[@totemsdk/pubsub-transport](../index.md) / WebSocketPubSubOptions

# Interface: WebSocketPubSubOptions

## Properties

### clientId?

> `optional` **clientId?**: `string`

***

### readyTimeoutMs?

> `optional` **readyTimeoutMs?**: `number`

***

### token?

> `optional` **token?**: `string`

***

### url

> **url**: `string`

***

### WebSocketImpl?

> `optional` **WebSocketImpl?**: (`url`) => `WebSocketLike`

Injectable WebSocket constructor (browser global by default).

#### Parameters

##### url

`string`

#### Returns

`WebSocketLike`
