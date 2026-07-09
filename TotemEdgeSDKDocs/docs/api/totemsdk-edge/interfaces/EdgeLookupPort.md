[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / EdgeLookupPort

# Interface: EdgeLookupPort

## Methods

### lookup()

> **lookup**(`params`): `Promise`\<[`EdgeOperationResult`](EdgeOperationResult.md)\<\{ `results`: `unknown`[]; \}\>\>

#### Parameters

##### params

###### kind?

`string`

###### query

`string`

#### Returns

`Promise`\<[`EdgeOperationResult`](EdgeOperationResult.md)\<\{ `results`: `unknown`[]; \}\>\>

***

### watch()

> **watch**(`params`): `Promise`\<[`EdgeOperationResult`](EdgeOperationResult.md)\<\{ `unsubscribe`: () => `void`; \}\>\>

#### Parameters

##### params

###### address

`string`

###### onUpdate

(`data`) => `void`

#### Returns

`Promise`\<[`EdgeOperationResult`](EdgeOperationResult.md)\<\{ `unsubscribe`: () => `void`; \}\>\>
