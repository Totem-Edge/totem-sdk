[**@totemsdk/lookup-client**](../index.md)

***

[@totemsdk/lookup-client](../index.md) / LookupClientConfig

# Interface: LookupClientConfig

## Properties

### hyperswarmTopic?

> `optional` **hyperswarmTopic?**: `string`

Hex-encoded 32-byte Hyperswarm topic key (64 hex chars). Primary P2P transport.

***

### nodeUrl?

> `optional` **nodeUrl?**: `string`

Direct HTTP/WS URL fallback — used when Hyperswarm is unavailable.
 The client will convert http(s):// to ws(s):// automatically.

***

### reconnectBaseMs?

> `optional` **reconnectBaseMs?**: `number`

Initial reconnect backoff delay in ms. Default: 1_000.

***

### reconnectMaxMs?

> `optional` **reconnectMaxMs?**: `number`

Maximum reconnect backoff delay in ms. Default: 30_000.

***

### timeoutMs?

> `optional` **timeoutMs?**: `number`

Per-request timeout in milliseconds. Default: 10_000.
