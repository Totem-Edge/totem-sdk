[**@totemsdk/decision**](../index.md)

***

[@totemsdk/decision](../index.md) / DecisionProvider

# Interface: DecisionProvider

Provider-neutral decision interface.

Implementors are compute-only: they cannot sign, move value, or hold private
keys. `decide` returns a proposal subject to runtime validation; providers
cannot supply bindings, receipts, or attempts.

## Properties

### capabilities

> `readonly` **capabilities**: readonly [`DecisionCapability`](../type-aliases/DecisionCapability.md)[]

***

### displayName

> `readonly` **displayName**: `string`

***

### id

> `readonly` **id**: `string`

***

### info?

> `readonly` `optional` **info?**: [`DecisionProviderInfo`](DecisionProviderInfo.md)

***

### isReady

> `readonly` **isReady**: `boolean`

***

### version

> `readonly` **version**: `string`

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

> **decide**(`request`): `Promise`\<[`DecisionProviderFailure`](DecisionProviderFailure.md) \| [`DecisionProviderSuccess`](DecisionProviderSuccess.md)\<[`DecisionResult`](../type-aliases/DecisionResult.md)\>\>

#### Parameters

##### request

[`DecisionProviderRequest`](../type-aliases/DecisionProviderRequest.md)

#### Returns

`Promise`\<[`DecisionProviderFailure`](DecisionProviderFailure.md) \| [`DecisionProviderSuccess`](DecisionProviderSuccess.md)\<[`DecisionResult`](../type-aliases/DecisionResult.md)\>\>
