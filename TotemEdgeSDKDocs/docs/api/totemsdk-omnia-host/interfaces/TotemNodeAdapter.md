[**@totemsdk/omnia-host**](../index.md)

***

[@totemsdk/omnia-host](../index.md) / TotemNodeAdapter

# Interface: TotemNodeAdapter

## Extends

- `ChainStateProvider`

## Methods

### broadcastTxPoW()

> **broadcastTxPoW**(`txpowHex`): `Promise`\<`BroadcastResult`\>

#### Parameters

##### txpowHex

`string`

#### Returns

`Promise`\<`BroadcastResult`\>

#### Inherited from

`ChainStateProvider.broadcastTxPoW`

***

### close()

> **close**(): `void`

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

#### Inherited from

`ChainStateProvider.getCoin`

***

### getCoins()

> **getCoins**(`query`): `Promise`\<`Coin`[]\>

#### Parameters

##### query

`CoinsQuery`

#### Returns

`Promise`\<`Coin`[]\>

#### Inherited from

`ChainStateProvider.getCoins`

***

### getMode()

> **getMode**(): `Promise`\<`string` \| `undefined`\>

#### Returns

`Promise`\<`string` \| `undefined`\>

***

### getProof()

> **getProof**(`coinId`): `Promise`\<`MMRProof`\>

#### Parameters

##### coinId

`string`

#### Returns

`Promise`\<`MMRProof`\>

#### Inherited from

`ChainStateProvider.getProof`

***

### getTip()

> **getTip**(): `Promise`\<`ChainTip`\>

#### Returns

`Promise`\<`ChainTip`\>

#### Inherited from

`ChainStateProvider.getTip`

***

### getToken()

> **getToken**(`tokenId`): `Promise`\<`TokenInfo`\>

#### Parameters

##### tokenId

`string`

#### Returns

`Promise`\<`TokenInfo`\>

#### Inherited from

`ChainStateProvider.getToken`

***

### getTokensByCreator()

> **getTokensByCreator**(`address`): `Promise`\<`TokenInfo`[]\>

#### Parameters

##### address

`string`

#### Returns

`Promise`\<`TokenInfo`[]\>

#### Inherited from

`ChainStateProvider.getTokensByCreator`

***

### searchTokens()

> **searchTokens**(`query`): `Promise`\<`TokenInfo`[]\>

#### Parameters

##### query

`TokenSearchQuery`

#### Returns

`Promise`\<`TokenInfo`[]\>

#### Inherited from

`ChainStateProvider.searchTokens`

***

### subscribe()

> **subscribe**(`listener`): () => `void`

#### Parameters

##### listener

(`tip`) => `void`

#### Returns

() => `void`

***

### waitForConfirmation()

> **waitForConfirmation**(`coinId`, `options?`): `Promise`\<`void`\>

#### Parameters

##### coinId

`string`

##### options?

[`ConfirmationOptions`](ConfirmationOptions.md)

#### Returns

`Promise`\<`void`\>
