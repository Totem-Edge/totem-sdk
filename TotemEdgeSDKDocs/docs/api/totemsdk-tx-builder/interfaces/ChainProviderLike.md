[**@totemsdk/tx-builder**](../index.md)

***

[@totemsdk/tx-builder](../index.md) / ChainProviderLike

# Interface: ChainProviderLike

## Methods

### exportCoin()?

> `optional` **exportCoin**(`coinId`): `Promise`\<\{ `coinid`: `string`; `data`: `string`; \} \| `null`\>

#### Parameters

##### coinId

`string`

#### Returns

`Promise`\<\{ `coinid`: `string`; `data`: `string`; \} \| `null`\>

***

### getCoins()

> **getCoins**(`query`): `Promise`\<`Record`\<`string`, `unknown`\>[]\>

#### Parameters

##### query

[`TxCoinQuery`](TxCoinQuery.md)

#### Returns

`Promise`\<`Record`\<`string`, `unknown`\>[]\>
