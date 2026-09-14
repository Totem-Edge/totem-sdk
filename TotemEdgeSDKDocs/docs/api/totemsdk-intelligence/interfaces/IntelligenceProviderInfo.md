[**@totemsdk/intelligence**](../index.md)

***

[@totemsdk/intelligence](../index.md) / IntelligenceProviderInfo

# Interface: IntelligenceProviderInfo

Capability advertisement for discovery — a snapshot of a provider's
supported surface at a point in time.

## Properties

### capabilities

> `readonly` **capabilities**: readonly (`"intelligence:llm"` \| `"intelligence:embed"` \| `"intelligence:rag"` \| `"intelligence:asr"` \| `"intelligence:translate"` \| `"intelligence:tts"` \| `"intelligence:diffusion"` \| `"intelligence:ocr"` \| `"intelligence:classify"` \| `"intelligence:audiogen"` \| `"intelligence:video"` \| `"intelligence:vla"` \| `"intelligence:world"` \| `"intelligence:models"` \| `"intelligence:system"` \| `"intelligence:plugins"`)[]

***

### displayName

> `readonly` **displayName**: `string`

***

### domains

> `readonly` **domains**: readonly [`IntelligenceDomain`](../type-aliases/IntelligenceDomain.md)[]

***

### id

> `readonly` **id**: `string`

***

### isReady

> `readonly` **isReady**: `boolean`

***

### version

> `readonly` **version**: `string`
