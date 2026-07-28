[**@totemsdk/wallet-adapter**](../index.md)

***

[@totemsdk/wallet-adapter](../index.md) / ChainProviderLike

# Interface: ChainProviderLike

## Methods

### broadcastTxPoW()

> **broadcastTxPoW**(`txpowHex`): `Promise`\<\{ `message?`: `string`; `success`: `boolean`; `txpowid?`: `string`; \}\>

#### Parameters

##### txpowHex

`string`

#### Returns

`Promise`\<\{ `message?`: `string`; `success`: `boolean`; `txpowid?`: `string`; \}\>

***

### getCoin()

> **getCoin**(`coinId`): `Promise`\<`unknown`\>

#### Parameters

##### coinId

`string`

#### Returns

`Promise`\<`unknown`\>

***

### getCoins()

> **getCoins**(`query`): `Promise`\<`unknown`[]\>

#### Parameters

##### query

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`unknown`[]\>

***

### getProof()

> **getProof**(`coinId`): `Promise`\<`unknown`\>

#### Parameters

##### coinId

`string`

#### Returns

`Promise`\<`unknown`\>

***

### getTip()

> **getTip**(): `Promise`\<\{ `block`: `number`; `hash`: `string`; `time?`: `string`; \}\>

#### Returns

`Promise`\<\{ `block`: `number`; `hash`: `string`; `time?`: `string`; \}\>

***

### getToken()

> **getToken**(`tokenId`): `Promise`\<`unknown`\>

#### Parameters

##### tokenId

`string`

#### Returns

`Promise`\<`unknown`\>

***

### getTokensByCreator()

> **getTokensByCreator**(`address`): `Promise`\<`unknown`[]\>

#### Parameters

##### address

`string`

#### Returns

`Promise`\<`unknown`[]\>

***

### searchTokens()

> **searchTokens**(`query`): `Promise`\<`unknown`[]\>

#### Parameters

##### query

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`unknown`[]\>
