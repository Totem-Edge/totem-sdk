[**@totemsdk/tx-builder**](../index.md)

***

[@totemsdk/tx-builder](../index.md) / CoinProvider

# Interface: CoinProvider

## Methods

### getCoinProof()?

> `optional` **getCoinProof**(`coinId`): `Promise`\<`string` \| `null`\>

Serialized `coinexport` proof bytes (hex), when the provider can supply it.

#### Parameters

##### coinId

`string`

#### Returns

`Promise`\<`string` \| `null`\>

***

### getCoins()

> **getCoins**(`query`): `Promise`\<[`TxCoin`](TxCoin.md)[]\>

#### Parameters

##### query

[`TxCoinQuery`](TxCoinQuery.md)

#### Returns

`Promise`\<[`TxCoin`](TxCoin.md)[]\>
