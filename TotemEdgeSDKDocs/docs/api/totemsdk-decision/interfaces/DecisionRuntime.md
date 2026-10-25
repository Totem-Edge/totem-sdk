[**@totemsdk/decision**](../index.md)

***

[@totemsdk/decision](../index.md) / DecisionRuntime

# Interface: DecisionRuntime

## Properties

### capabilities

> `readonly` **capabilities**: readonly [`DecisionCapability`](../type-aliases/DecisionCapability.md)[]

Capabilities actually reachable through the configured routes.

## Methods

### cancel()?

> `optional` **cancel**(`requestId`): `Promise`\<[`DecisionProviderFailure`](DecisionProviderFailure.md) \| \{ `ok`: `true`; `requestId`: `string`; \}\>

#### Parameters

##### requestId

`string`

#### Returns

`Promise`\<[`DecisionProviderFailure`](DecisionProviderFailure.md) \| \{ `ok`: `true`; `requestId`: `string`; \}\>

***

### close()?

> `optional` **close**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### decide()

> **decide**(`request`): `Promise`\<[`DecisionOutcome`](../type-aliases/DecisionOutcome.md)\<[`DecisionResult`](../type-aliases/DecisionResult.md)\>\>

#### Parameters

##### request

[`DecisionRequest`](../type-aliases/DecisionRequest.md)

#### Returns

`Promise`\<[`DecisionOutcome`](../type-aliases/DecisionOutcome.md)\<[`DecisionResult`](../type-aliases/DecisionResult.md)\>\>
