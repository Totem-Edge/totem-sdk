[**@totemsdk/pubsub-transport**](../index.md)

***

[@totemsdk/pubsub-transport](../index.md) / HubClientFrame

# Type Alias: HubClientFrame

> **HubClientFrame** = \{ `clientId?`: `string`; `op`: `"hello"`; `token?`: `string`; \} \| \{ `id?`: `string`; `op`: `"sub"`; `topic`: `string`; \} \| \{ `id?`: `string`; `op`: `"unsub"`; `topic`: `string`; \} \| \{ `id?`: `string`; `op`: `"pub"`; `payload`: `string`; `topic`: `string`; \} \| \{ `id?`: `string`; `op`: `"ping"`; \}

Client → hub frame. Payloads are base64 so the protocol stays JSON-safe.
