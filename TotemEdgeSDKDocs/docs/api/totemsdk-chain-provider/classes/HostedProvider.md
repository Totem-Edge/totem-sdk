[**@totemsdk/chain-provider**](../index.md)

***

[@totemsdk/chain-provider](../index.md) / HostedProvider

# Class: HostedProvider

## Implements

- [`ChainStateProvider`](../interfaces/ChainStateProvider.md)

## Constructors

### Constructor

> **new HostedProvider**(`config`): `HostedProvider`

#### Parameters

##### config

[`HostedProviderConfig`](../interfaces/HostedProviderConfig.md)

#### Returns

`HostedProvider`

## Methods

### broadcastTxPoW()

> **broadcastTxPoW**(`txpowHex`): `Promise`\<[`BroadcastResult`](../interfaces/BroadcastResult.md)\>

#### Parameters

##### txpowHex

`string`

#### Returns

`Promise`\<[`BroadcastResult`](../interfaces/BroadcastResult.md)\>

#### Implementation of

[`ChainStateProvider`](../interfaces/ChainStateProvider.md).[`broadcastTxPoW`](../interfaces/ChainStateProvider.md#broadcasttxpow)

***

### getCoin()

> **getCoin**(`coinId`): `Promise`\<[`Coin`](../interfaces/Coin.md) \| `null`\>

#### Parameters

##### coinId

`string`

#### Returns

`Promise`\<[`Coin`](../interfaces/Coin.md) \| `null`\>

#### Implementation of

[`ChainStateProvider`](../interfaces/ChainStateProvider.md).[`getCoin`](../interfaces/ChainStateProvider.md#getcoin)

***

### getCoins()

> **getCoins**(`query`): `Promise`\<[`Coin`](../interfaces/Coin.md)[]\>

#### Parameters

##### query

[`CoinsQuery`](../interfaces/CoinsQuery.md)

#### Returns

`Promise`\<[`Coin`](../interfaces/Coin.md)[]\>

#### Implementation of

[`ChainStateProvider`](../interfaces/ChainStateProvider.md).[`getCoins`](../interfaces/ChainStateProvider.md#getcoins)

***

### getProof()

> **getProof**(`coinId`): `Promise`\<[`MMRProof`](../interfaces/MMRProof.md)\>

#### Parameters

##### coinId

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

> **getToken**(`tokenId`): `Promise`\<[`TokenInfo`](../interfaces/TokenInfo.md)\>

#### Parameters

##### tokenId

`string`

#### Returns

`Promise`\<[`TokenInfo`](../interfaces/TokenInfo.md)\>

#### Implementation of

[`ChainStateProvider`](../interfaces/ChainStateProvider.md).[`getToken`](../interfaces/ChainStateProvider.md#gettoken)

***

### getTokensByCreator()

> **getTokensByCreator**(`address`): `Promise`\<[`TokenInfo`](../interfaces/TokenInfo.md)[]\>

#### Parameters

##### address

`string`

#### Returns

`Promise`\<[`TokenInfo`](../interfaces/TokenInfo.md)[]\>

#### Implementation of

[`ChainStateProvider`](../interfaces/ChainStateProvider.md).[`getTokensByCreator`](../interfaces/ChainStateProvider.md#gettokensbycreator)

***

### searchTokens()

> **searchTokens**(`query`): `Promise`\<[`TokenInfo`](../interfaces/TokenInfo.md)[]\>

#### Parameters

##### query

[`TokenSearchQuery`](../interfaces/TokenSearchQuery.md)

#### Returns

`Promise`\<[`TokenInfo`](../interfaces/TokenInfo.md)[]\>

#### Implementation of

[`ChainStateProvider`](../interfaces/ChainStateProvider.md).[`searchTokens`](../interfaces/ChainStateProvider.md#searchtokens)
