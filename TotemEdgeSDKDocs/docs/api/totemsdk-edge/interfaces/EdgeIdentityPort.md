[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / EdgeIdentityPort

# Interface: EdgeIdentityPort

## Methods

### resolve()

> **resolve**(`identityId`): `Promise`\<[`EdgeOperationResult`](EdgeOperationResult.md)\<\{ `identity`: `unknown`; \}\>\>

#### Parameters

##### identityId

`string`

#### Returns

`Promise`\<[`EdgeOperationResult`](EdgeOperationResult.md)\<\{ `identity`: `unknown`; \}\>\>

***

### verify()

> **verify**(`proof`): `Promise`\<[`EdgeOperationResult`](EdgeOperationResult.md)\<\{ `address?`: `string`; `valid`: `boolean`; \}\>\>

#### Parameters

##### proof

`unknown`

#### Returns

`Promise`\<[`EdgeOperationResult`](EdgeOperationResult.md)\<\{ `address?`: `string`; `valid`: `boolean`; \}\>\>
