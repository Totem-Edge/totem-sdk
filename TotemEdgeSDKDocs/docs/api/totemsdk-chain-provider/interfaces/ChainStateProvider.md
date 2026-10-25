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

### getMinTxPowWork()?

> `optional` **getMinTxPowWork**(): `Promise`\<`string` \| `null`\>

Live minimum TxPoW work (32-byte hex target) from the node's Magic numbers.
Optional: providers that cannot read it let callers fall back to the
protocol default. Used to mine transactions to the current network target.

#### Returns

`Promise`\<`string` \| `null`\>

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

***

### submitTransaction()?

> `optional` **submitTransaction**(`txBytes`, `witnessBytes`, `id?`): `Promise`\<[`BroadcastResult`](BroadcastResult.md)\>

Submit a raw transaction + witness through the node's explicit-mine path:
`txnmine` (node builds the TxPoW header with the real block number /
difficulty / magic and mines) followed by `sendtransaction`. When absent,
callers fall back to SDK-side mining + `broadcastTxPoW`.

#### Parameters

##### txBytes

`Uint8Array`

##### witnessBytes

`Uint8Array`

##### id?

`string`

#### Returns

`Promise`\<[`BroadcastResult`](BroadcastResult.md)\>
