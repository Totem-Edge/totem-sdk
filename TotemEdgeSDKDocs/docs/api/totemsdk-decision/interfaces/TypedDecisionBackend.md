[**@totemsdk/decision**](../index.md)

***

[@totemsdk/decision](../index.md) / TypedDecisionBackend

# Interface: TypedDecisionBackend

Shared typed-decision backend seam. Provider adapters translate backend
peculiarities; the shared translation implements the four semantics.

## Properties

### id

> `readonly` **id**: `string`

***

### version?

> `readonly` `optional` **version?**: `string`

## Methods

### predict()

> **predict**(`params`): `Promise`\<[`TypedBackendResult`](TypedBackendResult.md)\>

#### Parameters

##### params

###### questions

`Record`\<`string`, [`TypedBackendQuestion`](TypedBackendQuestion.md)\>

###### signal?

`AbortSignal`

###### state

[`DecisionValue`](../type-aliases/DecisionValue.md)

#### Returns

`Promise`\<[`TypedBackendResult`](TypedBackendResult.md)\>
