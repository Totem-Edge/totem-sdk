[**@totemsdk/chain-provider**](../index.md)

***

[@totemsdk/chain-provider](../index.md) / ChainStateProvider

# Interface: ChainStateProvider

## Methods

### broadcastTxPoW()

> **broadcastTxPoW**(`txpowHex`): `Promise`\<[`BroadcastResult`](BroadcastResult.md)\>

#### Parameters

##### txpowHex

`string`

#### Returns

`Promise`\<[`BroadcastResult`](BroadcastResult.md)\>

***

### getCoin()

> **getCoin**(`coinId`): `Promise`\<[`Coin`](Coin.md) \| `null`\>

#### Parameters

##### coinId

`string`

#### Returns

`Promise`\<[`Coin`](Coin.md) \| `null`\>

***

### getCoins()

> **getCoins**(`query`): `Promise`\<[`Coin`](Coin.md)[]\>

#### Parameters

##### query

[`CoinsQuery`](CoinsQuery.md)

#### Returns

`Promise`\<[`Coin`](Coin.md)[]\>

***

### getProof()

> **getProof**(`coinId`): `Promise`\<[`MMRProof`](MMRProof.md)\>

#### Parameters

##### coinId

`string`

#### Returns

`Promise`\<[`MMRProof`](MMRProof.md)\>

***

### getTip()

> **getTip**(): `Promise`\<[`ChainTip`](ChainTip.md)\>

#### Returns

`Promise`\<[`ChainTip`](ChainTip.md)\>

***

### getToken()

> **getToken**(`tokenId`): `Promise`\<[`TokenInfo`](TokenInfo.md)\>

#### Parameters

##### tokenId

`string`

#### Returns

`Promise`\<[`TokenInfo`](TokenInfo.md)\>

***

### getTokensByCreator()

> **getTokensByCreator**(`address`): `Promise`\<[`TokenInfo`](TokenInfo.md)[]\>

#### Parameters

##### address

`string`

#### Returns

`Promise`\<[`TokenInfo`](TokenInfo.md)[]\>

***

### searchTokens()

> **searchTokens**(`query`): `Promise`\<[`TokenInfo`](TokenInfo.md)[]\>

#### Parameters

##### query

[`TokenSearchQuery`](TokenSearchQuery.md)

#### Returns

`Promise`\<[`TokenInfo`](TokenInfo.md)[]\>
