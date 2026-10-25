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

### getMinTxPowWork()?

> `optional` **getMinTxPowWork**(): `Promise`\<`string` \| `null`\>

Live minimum TxPoW work (32-byte hex target) from the node's Magic numbers.
Optional: providers that cannot read it let callers fall back to the
protocol default. Used to mine transactions to the current network target.

#### Returns

`Promise`\<`string` \| `null`\>

#### Inherited from

`ChainStateProvider.getMinTxPowWork`

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

### signData()

> **signData**(`pubkeyHex`, `dataHex`): `Promise`\<`string`\>

Sign arbitrary data with a wallet key (`sign publickey:<0x> data:<0x>`).
Used to produce the funding witness signature: createChannel builds the
funding digest, and this signs it with the funding coin's key.

#### Parameters

##### pubkeyHex

`string`

##### dataHex

`string`

#### Returns

`Promise`\<`string`\>

***

### submitTransaction()?

> `optional` **submitTransaction**(`txBytes`, `witnessBytes`, `id?`): `Promise`\<`BroadcastResult`\>

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

`Promise`\<`BroadcastResult`\>

#### Inherited from

`ChainStateProvider.submitTransaction`

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
