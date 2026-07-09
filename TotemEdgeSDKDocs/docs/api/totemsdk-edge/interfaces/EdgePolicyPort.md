[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / EdgePolicyPort

# Interface: EdgePolicyPort

## Methods

### check()

> **check**(`params`): `Promise`\<[`EdgeOperationResult`](EdgeOperationResult.md)\<\{ `allowed`: `boolean`; `reason?`: `string`; \}\>\>

#### Parameters

##### params

###### action

`string`

###### context?

`Record`\<`string`, `unknown`\>

###### subject

`string`

#### Returns

`Promise`\<[`EdgeOperationResult`](EdgeOperationResult.md)\<\{ `allowed`: `boolean`; `reason?`: `string`; \}\>\>
