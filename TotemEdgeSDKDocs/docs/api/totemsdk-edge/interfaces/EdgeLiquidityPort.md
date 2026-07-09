[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / EdgeLiquidityPort

# Interface: EdgeLiquidityPort

## Methods

### getBalance()

> **getBalance**(`address`): `Promise`\<[`EdgeOperationResult`](EdgeOperationResult.md)\<\{ `balance`: `string`; `tokenId`: `string`; \}\>\>

#### Parameters

##### address

`string`

#### Returns

`Promise`\<[`EdgeOperationResult`](EdgeOperationResult.md)\<\{ `balance`: `string`; `tokenId`: `string`; \}\>\>

***

### getUtxos()

> **getUtxos**(`address`): `Promise`\<[`EdgeOperationResult`](EdgeOperationResult.md)\<\{ `utxos`: `unknown`[]; \}\>\>

#### Parameters

##### address

`string`

#### Returns

`Promise`\<[`EdgeOperationResult`](EdgeOperationResult.md)\<\{ `utxos`: `unknown`[]; \}\>\>
