[**@totemsdk/qvac**](../index.md)

***

[@totemsdk/qvac](../index.md) / createQvacIntelligenceProvider

# Function: createQvacIntelligenceProvider()

> **createQvacIntelligenceProvider**(`options?`): `object`

Factory: wrap a QVAC SDK surface into an @totemsdk/intelligence provider.

The SDK is injected via `options.sdk`, resolved lazily via
`options.sdkLoader`, or required from the installed `@qvac/sdk` package at
first use. A normal app can construct the provider with zero configuration
when `@qvac/sdk` is installed; injection remains available for tests and
custom runtimes.

## Parameters

### options?

[`QvacProviderOptions`](../interfaces/QvacProviderOptions.md) = `{}`

## Returns

`object`

### activeRequests

> `readonly` **activeRequests**: `ReadonlyMap`\<`string`, `AbortController`\>

### capabilities

> `readonly` **capabilities**: (`"intelligence:llm"` \| `"intelligence:embed"` \| `"intelligence:rag"` \| `"intelligence:asr"` \| `"intelligence:translate"` \| `"intelligence:tts"` \| `"intelligence:diffusion"` \| `"intelligence:ocr"` \| `"intelligence:classify"` \| `"intelligence:audiogen"` \| `"intelligence:video"` \| `"intelligence:vla"` \| `"intelligence:world"` \| `"intelligence:models"` \| `"intelligence:system"` \| `"intelligence:plugins"`)[]

### discoverCapabilities

> `readonly` **discoverCapabilities**: () => (`"intelligence:llm"` \| `"intelligence:embed"` \| `"intelligence:rag"` \| `"intelligence:asr"` \| `"intelligence:translate"` \| `"intelligence:tts"` \| `"intelligence:diffusion"` \| `"intelligence:ocr"` \| `"intelligence:classify"` \| `"intelligence:audiogen"` \| `"intelligence:video"` \| `"intelligence:vla"` \| `"intelligence:world"` \| `"intelligence:models"` \| `"intelligence:system"` \| `"intelligence:plugins"`)[]

#### Returns

(`"intelligence:llm"` \| `"intelligence:embed"` \| `"intelligence:rag"` \| `"intelligence:asr"` \| `"intelligence:translate"` \| `"intelligence:tts"` \| `"intelligence:diffusion"` \| `"intelligence:ocr"` \| `"intelligence:classify"` \| `"intelligence:audiogen"` \| `"intelligence:video"` \| `"intelligence:vla"` \| `"intelligence:world"` \| `"intelligence:models"` \| `"intelligence:system"` \| `"intelligence:plugins"`)[]

### displayName

> `readonly` **displayName**: `string`

### id

> `readonly` **id**: `string`

### isReady

> `readonly` **isReady**: `boolean`

### sdk?

> `readonly` `optional` **sdk?**: [`QvacSdkLike`](../interfaces/QvacSdkLike.md)

### version

> `readonly` **version**: `string`

### cancel()

> **cancel**(`requestId`): `Promise`\<`IntelligenceOutcome`\<`void`\>\>

#### Parameters

##### requestId

`string`

#### Returns

`Promise`\<`IntelligenceOutcome`\<`void`\>\>

### close()

> **close**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

### invoke()

> **invoke**\<`T`\>(`op`): `Promise`\<`IntelligenceOutcome`\<`T`\>\>

#### Type Parameters

##### T

`T` = `unknown`

#### Parameters

##### op

`IntelligenceOperation`\<`T`\>

#### Returns

`Promise`\<`IntelligenceOutcome`\<`T`\>\>

### invokeStream()

> **invokeStream**(`op`): `AsyncIterable`\<`IntelligenceStreamChunk`\>

#### Parameters

##### op

`IntelligenceStreamOperation`

#### Returns

`AsyncIterable`\<`IntelligenceStreamChunk`\>
