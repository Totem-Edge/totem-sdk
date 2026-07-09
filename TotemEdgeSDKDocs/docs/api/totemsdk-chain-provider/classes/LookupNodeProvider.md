[**@totemsdk/chain-provider**](../index.md)

***

[@totemsdk/chain-provider](../index.md) / LookupNodeProvider

# Class: LookupNodeProvider

## Implements

- [`ChainStateProvider`](../interfaces/ChainStateProvider.md)

## Constructors

### Constructor

> **new LookupNodeProvider**(): `LookupNodeProvider`

#### Returns

`LookupNodeProvider`

## Methods

### broadcastTxPoW()

> **broadcastTxPoW**(`_txpowHex`): `Promise`\<[`BroadcastResult`](../interfaces/BroadcastResult.md)\>

#### Parameters

##### \_txpowHex

`string`

#### Returns

`Promise`\<[`BroadcastResult`](../interfaces/BroadcastResult.md)\>

#### Implementation of

[`ChainStateProvider`](../interfaces/ChainStateProvider.md).[`broadcastTxPoW`](../interfaces/ChainStateProvider.md#broadcasttxpow)

***

### getCoin()

> **getCoin**(`_coinId`): `Promise`\<[`Coin`](../interfaces/Coin.md) \| `null`\>

#### Parameters

##### \_coinId

`string`

#### Returns

`Promise`\<[`Coin`](../interfaces/Coin.md) \| `null`\>

#### Implementation of

[`ChainStateProvider`](../interfaces/ChainStateProvider.md).[`getCoin`](../interfaces/ChainStateProvider.md#getcoin)

***

### getCoins()

> **getCoins**(`_query`): `Promise`\<[`Coin`](../interfaces/Coin.md)[]\>

#### Parameters

##### \_query

[`CoinsQuery`](../interfaces/CoinsQuery.md)

#### Returns

`Promise`\<[`Coin`](../interfaces/Coin.md)[]\>

#### Implementation of

[`ChainStateProvider`](../interfaces/ChainStateProvider.md).[`getCoins`](../interfaces/ChainStateProvider.md#getcoins)

***

### getProof()

> **getProof**(`_coinId`): `Promise`\<[`MMRProof`](../interfaces/MMRProof.md)\>

#### Parameters

##### \_coinId

`string`

#### Returns

`Promise`\<[`MMRProof`](../interfaces/MMRProof.md)\>

#### Implementation of

[`ChainStateProvider`](../interfaces/ChainStateProvider.md).[`getProof`](../interfaces/ChainStateProvider.md#getproof)

***

### getTip()

> **getTip**(): `Promise`\<[`ChainTip`](../interfaces/ChainTip.md)\>

#### Returns

`Promise`\<[`ChainTip`](../interfaces/ChainTip.md)\>

#### Implementation of

[`ChainStateProvider`](../interfaces/ChainStateProvider.md).[`getTip`](../interfaces/ChainStateProvider.md#gettip)

***

### getToken()

> **getToken**(`_tokenId`): `Promise`\<[`TokenInfo`](../interfaces/TokenInfo.md)\>

#### Parameters

##### \_tokenId

`string`

#### Returns

`Promise`\<[`TokenInfo`](../interfaces/TokenInfo.md)\>

#### Implementation of

[`ChainStateProvider`](../interfaces/ChainStateProvider.md).[`getToken`](../interfaces/ChainStateProvider.md#gettoken)

***

### getTokensByCreator()

> **getTokensByCreator**(`_address`): `Promise`\<[`TokenInfo`](../interfaces/TokenInfo.md)[]\>

#### Parameters

##### \_address

`string`

#### Returns

`Promise`\<[`TokenInfo`](../interfaces/TokenInfo.md)[]\>

#### Implementation of

[`ChainStateProvider`](../interfaces/ChainStateProvider.md).[`getTokensByCreator`](../interfaces/ChainStateProvider.md#gettokensbycreator)

***

### searchTokens()

> **searchTokens**(`_query`): `Promise`\<[`TokenInfo`](../interfaces/TokenInfo.md)[]\>

#### Parameters

##### \_query

[`TokenSearchQuery`](../interfaces/TokenSearchQuery.md)

#### Returns

`Promise`\<[`TokenInfo`](../interfaces/TokenInfo.md)[]\>

#### Implementation of

[`ChainStateProvider`](../interfaces/ChainStateProvider.md).[`searchTokens`](../interfaces/ChainStateProvider.md#searchtokens)
