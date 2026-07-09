[**@totemsdk/lookup-client**](../index.md)

***

[@totemsdk/lookup-client](../index.md) / LookupClient

# Class: LookupClient

## Constructors

### Constructor

> **new LookupClient**(`_config`): `LookupClient`

#### Parameters

##### \_config

[`LookupClientConfig`](../interfaces/LookupClientConfig.md)

#### Returns

`LookupClient`

## Methods

### \_connect()

> **\_connect**(`transport`): `Promise`\<`void`\>

#### Parameters

##### transport

[`ITransport`](../interfaces/ITransport.md)

#### Returns

`Promise`\<`void`\>

***

### broadcastTxPoW()

> **broadcastTxPoW**(`txpowHex`): `Promise`\<`BroadcastResult`\>

#### Parameters

##### txpowHex

`string`

#### Returns

`Promise`\<`BroadcastResult`\>

***

### disconnect()

> **disconnect**(): `void`

#### Returns

`void`

***

### getCoin()

> **getCoin**(`coinId`): `Promise`\<`Coin` \| `null`\>

#### Parameters

##### coinId

`string`

#### Returns

`Promise`\<`Coin` \| `null`\>

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

> **getTokensByCreator**(`_address`): `Promise`\<`TokenInfo`[]\>

#### Parameters

##### \_address

`string`

#### Returns

`Promise`\<`TokenInfo`[]\>

***

### on()

> **on**(`event`, `handler`): [`Unsubscribe`](../type-aliases/Unsubscribe.md)

#### Parameters

##### event

`"reconnecting"` \| `"reconnected"`

##### handler

`EventHandler`

#### Returns

[`Unsubscribe`](../type-aliases/Unsubscribe.md)

***

### searchTokens()

> **searchTokens**(`_query`): `Promise`\<`TokenInfo`[]\>

#### Parameters

##### \_query

`TokenSearchQuery`

#### Returns

`Promise`\<`TokenInfo`[]\>

***

### subscribeCoinUpdates()

> **subscribeCoinUpdates**(`cb`): [`Unsubscribe`](../type-aliases/Unsubscribe.md)

#### Parameters

##### cb

[`CoinUpdateCallback`](../type-aliases/CoinUpdateCallback.md)

#### Returns

[`Unsubscribe`](../type-aliases/Unsubscribe.md)

***

### watchAddress()

> **watchAddress**(`address`): `Promise`\<`void`\>

#### Parameters

##### address

`string`

#### Returns

`Promise`\<`void`\>

***

### watchCoin()

> **watchCoin**(`coinId`): `Promise`\<`void`\>

#### Parameters

##### coinId

`string`

#### Returns

`Promise`\<`void`\>

***

### watchScript()

> **watchScript**(`script`): `Promise`\<`void`\>

#### Parameters

##### script

`string`

#### Returns

`Promise`\<`void`\>
