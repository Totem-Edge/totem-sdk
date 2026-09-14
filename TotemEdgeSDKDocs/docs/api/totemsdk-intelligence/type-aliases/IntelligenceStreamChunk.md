[**@totemsdk/intelligence**](../index.md)

***

[@totemsdk/intelligence](../index.md) / IntelligenceStreamChunk

# Type Alias: IntelligenceStreamChunk

> **IntelligenceStreamChunk** = \{ `text`: `string`; `type`: `"token"`; \} \| \{ `index?`: `number`; `text`: `string`; `type`: `"segment"`; \} \| \{ `data`: `unknown`; `mimeType?`: `string`; `type`: `"audio"`; \} \| \{ `data`: `unknown`; `mimeType?`: `string`; `type`: `"image"`; \} \| \{ `message?`: `string`; `percent?`: `number`; `step?`: `string`; `type`: `"progress"`; \} \| \{ `data`: `Record`\<`string`, `unknown`\>; `type`: `"delta"`; \} \| \{ `type`: `"done"`; `usage?`: [`IntelligenceUsage`](../interfaces/IntelligenceUsage.md); \}

Stream chunk types surfaced by intelligence providers.
