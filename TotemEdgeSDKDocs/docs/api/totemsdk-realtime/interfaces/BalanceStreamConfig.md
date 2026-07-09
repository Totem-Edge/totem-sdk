[**@totemsdk/realtime**](../index.md)

***

[@totemsdk/realtime](../index.md) / BalanceStreamConfig

# Interface: BalanceStreamConfig

## Properties

### backend?

> `optional` **backend?**: [`BalanceStreamBackend`](BalanceStreamBackend.md)

Optional custom backend. When set, all Axia HTTP/WS logic is bypassed.
See `BalanceStreamBackend` for the interface.

***

### baseUrl?

> `optional` **baseUrl?**: `string`

Axia API base URL. Required when using the default Axia backend.
Omit when providing a custom `backend`.

***

### httpPollInterval?

> `optional` **httpPollInterval?**: `number`

***

### maxCacheAge?

> `optional` **maxCacheAge?**: `number`

***

### projectId?

> `optional` **projectId?**: `string`

Axia project ID sent as `x-api-key`. Required for the default Axia backend.
Omit when providing a custom `backend`.

***

### reconnectDelays?

> `optional` **reconnectDelays?**: `number`[]

***

### tokenRefreshBuffer?

> `optional` **tokenRefreshBuffer?**: `number`
