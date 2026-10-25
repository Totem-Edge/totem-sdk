[**@totemsdk/decision**](../index.md)

***

[@totemsdk/decision](../index.md) / DecisionClientLike

# Interface: DecisionClientLike

## Methods

### predict()

> **predict**(`params`): `Promise`\<[`DecisionClientResult`](DecisionClientResult.md)\>

#### Parameters

##### params

###### model?

`string`

###### questions

readonly [`DecisionClientQuestion`](DecisionClientQuestion.md)[]

###### signal?

`AbortSignal`

###### state

[`DecisionValue`](../type-aliases/DecisionValue.md)

#### Returns

`Promise`\<[`DecisionClientResult`](DecisionClientResult.md)\>
