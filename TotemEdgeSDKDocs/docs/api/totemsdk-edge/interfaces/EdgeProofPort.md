[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / EdgeProofPort

# Interface: EdgeProofPort

## Methods

### createProof()

> **createProof**(`params`): `Promise`\<[`EdgeOperationResult`](EdgeOperationResult.md)\<\{ `proof`: `unknown`; `proofId`: `string`; \}\>\>

#### Parameters

##### params

###### claims

`unknown`[]

###### context?

`Record`\<`string`, `unknown`\>

###### subject

`string`

#### Returns

`Promise`\<[`EdgeOperationResult`](EdgeOperationResult.md)\<\{ `proof`: `unknown`; `proofId`: `string`; \}\>\>

***

### verifyProof()

> **verifyProof**(`params`): `Promise`\<[`EdgeOperationResult`](EdgeOperationResult.md)\<\{ `reason?`: `string`; `valid`: `boolean`; \}\>\>

#### Parameters

##### params

###### proof

`unknown`

###### subject?

`string`

#### Returns

`Promise`\<[`EdgeOperationResult`](EdgeOperationResult.md)\<\{ `reason?`: `string`; `valid`: `boolean`; \}\>\>
