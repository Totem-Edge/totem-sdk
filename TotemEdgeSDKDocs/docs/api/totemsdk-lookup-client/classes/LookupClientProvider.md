[**@totemsdk/lookup-client**](../index.md)

***

[@totemsdk/lookup-client](../index.md) / LookupClientProvider

# Class: LookupClientProvider

## Implements

- `ChainStateProvider`

## Constructors

### Constructor

> **new LookupClientProvider**(`_client`): `LookupClientProvider`

#### Parameters

##### \_client

[`LookupClient`](LookupClient.md)

#### Returns

`LookupClientProvider`

## Methods

### broadcastTxPoW()

> **broadcastTxPoW**(`txpowHex`): `Promise`\<`BroadcastResult`\>

#### Parameters

##### txpowHex

`string`

#### Returns

`Promise`\<`BroadcastResult`\>

#### Implementation of

`ChainStateProvider.broadcastTxPoW`

***

### getCoin()

> **getCoin**(`coinId`): `Promise`\<`Coin` \| `null`\>

#### Parameters

##### coinId

`string`

#### Returns

`Promise`\<`Coin` \| `null`\>

#### Implementation of

`ChainStateProvider.getCoin`

***

### getCoins()

> **getCoins**(`query`): `Promise`\<`Coin`[]\>

#### Parameters

##### query

`CoinsQuery`

#### Returns

`Promise`\<`Coin`[]\>

#### Implementation of

`ChainStateProvider.getCoins`

***

### getProof()

> **getProof**(`coinId`): `Promise`\<`MMRProof`\>

#### Parameters

##### coinId

`string`

#### Returns

`Promise`\<`MMRProof`\>

#### Implementation of

`ChainStateProvider.getProof`

***

### getTip()

> **getTip**(): `Promise`\<`ChainTip`\>

#### Returns

`Promise`\<`ChainTip`\>

#### Implementation of

`ChainStateProvider.getTip`

***

### getToken()

> **getToken**(`tokenId`): `Promise`\<`TokenInfo`\>

#### Parameters

##### tokenId

`string`

#### Returns

`Promise`\<`TokenInfo`\>

#### Implementation of

`ChainStateProvider.getToken`

***

### getTokensByCreator()

> **getTokensByCreator**(`address`): `Promise`\<`TokenInfo`[]\>

#### Parameters

##### address

`string`

#### Returns

`Promise`\<`TokenInfo`[]\>

#### Implementation of

`ChainStateProvider.getTokensByCreator`

***

### searchTokens()

> **searchTokens**(`query`): `Promise`\<`TokenInfo`[]\>

#### Parameters

##### query

`TokenSearchQuery`

#### Returns

`Promise`\<`TokenInfo`[]\>

#### Implementation of

`ChainStateProvider.searchTokens`
