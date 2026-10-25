[**@totemsdk/p2p-hub**](../index.md)

***

[@totemsdk/p2p-hub](../index.md) / WebSocketHubServerOptions

# Interface: WebSocketHubServerOptions

## Extends

- [`P2PHubOptions`](P2PHubOptions.md)

## Properties

### allowedOrigins?

> `optional` **allowedOrigins?**: `string`[]

Allowed browser origins, e.g. `chrome-extension://<id>` or `https://app`.

***

### allowedTopicPrefixes?

> `optional` **allowedTopicPrefixes?**: `string`[]

Optional topic prefixes; `undefined` allows every topic (loopback only).

#### Inherited from

[`P2PHubOptions`](P2PHubOptions.md).[`allowedTopicPrefixes`](P2PHubOptions.md#allowedtopicprefixes)

***

### host?

> `optional` **host?**: `string`

***

### hubId?

> `optional` **hubId?**: `string`

#### Inherited from

[`P2PHubOptions`](P2PHubOptions.md).[`hubId`](P2PHubOptions.md#hubid)

***

### maxMessagesPerSecond?

> `optional` **maxMessagesPerSecond?**: `number`

#### Inherited from

[`P2PHubOptions`](P2PHubOptions.md).[`maxMessagesPerSecond`](P2PHubOptions.md#maxmessagespersecond)

***

### maxPayloadBytes?

> `optional` **maxPayloadBytes?**: `number`

#### Inherited from

[`P2PHubOptions`](P2PHubOptions.md).[`maxPayloadBytes`](P2PHubOptions.md#maxpayloadbytes)

***

### network

> **network**: [`HubNetwork`](HubNetwork.md)

#### Inherited from

[`P2PHubOptions`](P2PHubOptions.md).[`network`](P2PHubOptions.md#network)

***

### port

> **port**: `number`

***

### token?

> `optional` **token?**: `string`

Shared bearer token expected in the first `hello` frame.

#### Inherited from

[`P2PHubOptions`](P2PHubOptions.md).[`token`](P2PHubOptions.md#token)
