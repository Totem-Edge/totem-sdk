[**@totemsdk/p2p-hub**](../index.md)

***

[@totemsdk/p2p-hub](../index.md) / P2PHubOptions

# Interface: P2PHubOptions

## Extended by

- [`WebSocketHubServerOptions`](WebSocketHubServerOptions.md)

## Properties

### allowedTopicPrefixes?

> `optional` **allowedTopicPrefixes?**: `string`[]

Optional topic prefixes; `undefined` allows every topic (loopback only).

***

### hubId?

> `optional` **hubId?**: `string`

***

### maxMessagesPerSecond?

> `optional` **maxMessagesPerSecond?**: `number`

***

### maxPayloadBytes?

> `optional` **maxPayloadBytes?**: `number`

***

### network

> **network**: [`HubNetwork`](HubNetwork.md)

***

### token?

> `optional` **token?**: `string`

Shared bearer token expected in the first `hello` frame.
