[**@totemsdk/intelligence**](../index.md)

***

[@totemsdk/intelligence](../index.md) / IntelligenceProvider

# Interface: IntelligenceProvider

Provider-neutral intelligence interface.

Implementors wrap a concrete inference runtime (QVAC, remote LLM gateway,
embedded model host, …). The provider is compute-only: it cannot sign,
cannot move value, and must never hold private keys.

## Properties

### capabilities

> `readonly` **capabilities**: readonly `` `intelligence:${string}` ``[]

Domains the provider currently supports.

***

### displayName

> `readonly` **displayName**: `string`

Human-readable provider name, e.g. 'QVAC In-situ Inference'.

***

### id

> `readonly` **id**: `string`

Stable provider identifier, e.g. 'qvac'.

***

### isReady

> `readonly` **isReady**: `boolean`

True if the provider is connected / ready.

***

### version

> `readonly` **version**: `string`

Wrapped provider runtime version.

## Methods

### cancel()

> **cancel**(`requestId`): `Promise`\<[`IntelligenceOutcome`](../type-aliases/IntelligenceOutcome.md)\<`void`\>\>

Cancel an in-flight operation by request id.

#### Parameters

##### requestId

`string`

#### Returns

`Promise`\<[`IntelligenceOutcome`](../type-aliases/IntelligenceOutcome.md)\<`void`\>\>

***

### close()

> **close**(): `Promise`\<`void`\>

Release provider resources. Further invoke calls should reject.

#### Returns

`Promise`\<`void`\>

***

### invoke()

> **invoke**\<`T`\>(`op`): `Promise`\<[`IntelligenceOutcome`](../type-aliases/IntelligenceOutcome.md)\<`T`\>\>

Execute a single inference operation.

Implementations MAY throw IntelligenceError for hard failures but should
prefer returning IntelligenceErrorResult for operational failures so the
caller can inspect code/retryable without try/catch.

#### Type Parameters

##### T

`T` = `unknown`

#### Parameters

##### op

[`IntelligenceOperation`](IntelligenceOperation.md)\<`T`\>

#### Returns

`Promise`\<[`IntelligenceOutcome`](../type-aliases/IntelligenceOutcome.md)\<`T`\>\>

***

### invokeStream()

> **invokeStream**(`op`): `AsyncIterable`\<[`IntelligenceStreamChunk`](../type-aliases/IntelligenceStreamChunk.md)\>

Execute a streaming inference operation.

Returns an async iterable of stream chunks. If the operation is not
stream-capable, the implementation must throw NOT_IMPLEMENTED.

#### Parameters

##### op

[`IntelligenceStreamOperation`](IntelligenceStreamOperation.md)

#### Returns

`AsyncIterable`\<[`IntelligenceStreamChunk`](../type-aliases/IntelligenceStreamChunk.md)\>
