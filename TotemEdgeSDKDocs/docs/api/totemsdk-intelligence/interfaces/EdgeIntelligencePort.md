[**@totemsdk/intelligence**](../index.md)

***

[@totemsdk/intelligence](../index.md) / EdgeIntelligencePort

# Interface: EdgeIntelligencePort

Edge-compatible intelligence port contract.

Lives in @totemsdk/intelligence (not @totemsdk/edge) so that adapters like
`@totemsdk/qvac/edge` can implement a port for @totemsdk/edge without
depending on edge itself. @totemsdk/edge re-exports this type and hosts
implementations via `EdgeRuntimePorts.intelligence`.

## Properties

### capabilities

> `readonly` **capabilities**: readonly `string`[]

Capability strings advertised (e.g. ['intelligence:llm', …]).

***

### providerId

> `readonly` **providerId**: `string`

Stable provider id (e.g. 'qvac').

## Methods

### cancel()?

> `optional` **cancel**(`requestId`): `Promise`\<[`IntelligencePortResult`](IntelligencePortResult.md)\<`unknown`\>\>

#### Parameters

##### requestId

`string`

#### Returns

`Promise`\<[`IntelligencePortResult`](IntelligencePortResult.md)\<`unknown`\>\>

***

### close()?

> `optional` **close**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### invoke()

> **invoke**(`params`): `Promise`\<[`IntelligencePortResult`](IntelligencePortResult.md)\<\{ `data`: `unknown`; `receipt?`: `unknown`; `usage?`: `Record`\<`string`, `unknown`\>; \}\>\>

#### Parameters

##### params

###### context?

`Record`\<`string`, `unknown`\>

###### domain

`string`

###### op

`string`

###### params

`Record`\<`string`, `unknown`\>

###### requestId?

`string`

###### signal?

`AbortSignal`

#### Returns

`Promise`\<[`IntelligencePortResult`](IntelligencePortResult.md)\<\{ `data`: `unknown`; `receipt?`: `unknown`; `usage?`: `Record`\<`string`, `unknown`\>; \}\>\>
