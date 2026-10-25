[**@totemsdk/pubsub-transport**](../index.md)

***

[@totemsdk/pubsub-transport](../index.md) / HubServerFrame

# Type Alias: HubServerFrame

> **HubServerFrame** = \{ `hubId`: `string`; `op`: `"ready"`; \} \| \{ `op`: `"msg"`; `payload`: `string`; `topic`: `string`; \} \| \{ `error?`: `string`; `id?`: `string`; `ok`: `boolean`; `op`: `"ack"`; \} \| \{ `id?`: `string`; `op`: `"pong"`; \} \| \{ `code?`: `string`; `error`: `string`; `op`: `"error"`; \}

Hub → client frame.
