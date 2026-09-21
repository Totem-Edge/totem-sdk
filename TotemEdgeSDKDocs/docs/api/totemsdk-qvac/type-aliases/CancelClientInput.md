[**@totemsdk/qvac**](../index.md)

***

[@totemsdk/qvac](../index.md) / CancelClientInput

# Type Alias: CancelClientInput

> **CancelClientInput** = \{ `clearCache?`: `boolean`; `requestId`: `string`; \} \| \{ `clearCache?`: `boolean`; `operation`: `"request"`; `requestId`: `string`; \} \| \{ `kind?`: `CancelKind`; `modelId`: `string`; \} \| \{ `kind?`: `CancelKind`; `modelId`: `string`; `operation`: `"broad"`; \} \| \{ `modelId`: `string`; `operation`: `"inference"`; \} \| \{ `modelId`: `string`; `operation`: `"embeddings"`; \}
