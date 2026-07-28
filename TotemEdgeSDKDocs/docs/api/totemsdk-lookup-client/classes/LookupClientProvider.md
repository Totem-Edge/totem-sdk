[**@totemsdk/lookup-client**](../index.md)

***

[@totemsdk/lookup-client](../index.md) / LookupClientProvider

# Class: LookupClientProvider

## Implements

- [`ITransport`](../type-aliases/ITransport.md)

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

***

### getCoin()

> **getCoin**(`coinId`): `Promise`\<`any`\>

#### Parameters

##### coinId

`string`

#### Returns

`Promise`\<`any`\>

***

### getCoins()

> **getCoins**(`query`): `Promise`\<`Coin`[]\>

#### Parameters

##### query

`CoinsQuery`

#### Returns

`Promise`\<`Coin`[]\>

***

### getProof()

> **getProof**(`coinId`): `Promise`\<`MMRProof`\>

#### Parameters

##### coinId

`string`

#### Returns

`Promise`\<`MMRProof`\>

***

### getTip()

> **getTip**(): `Promise`\<`ChainTip`\>

#### Returns

`Promise`\<`ChainTip`\>

***

### getToken()

> **getToken**(`tokenId`): `Promise`\<`TokenInfo`\>

#### Parameters

##### tokenId

`string`

#### Returns

`Promise`\<`TokenInfo`\>

***

### getTokensByCreator()

> **getTokensByCreator**(`address`): `Promise`\<`TokenInfo`[]\>

#### Parameters

##### address

`string`

#### Returns

`Promise`\<`TokenInfo`[]\>

***

### searchTokens()

> **searchTokens**(`query`): `Promise`\<`TokenInfo`[]\>

#### Parameters

##### query

`TokenSearchQuery`

#### Returns

`Promise`\<`TokenInfo`[]\>
