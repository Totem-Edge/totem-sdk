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

### exportCoin()?

> `optional` **exportCoin**(`coinId`): `Promise`\<`ExportedCoin` \| `null`\>

Serialized coin proof (Minima `coinexport`) for a specific coin id. Required
to assemble the funding input proof. Never expose this over a remote control
plane; it is caller-side material.

#### Parameters

##### coinId

`string`

#### Returns

`Promise`\<`ExportedCoin` \| `null`\>

***

### getAddressInfo()?

> `optional` **getAddressInfo**(`address`): `Promise`\<`AddressInfo` \| `null`\>

Ownership material for an address (public key + address script). Required to
build a funding witness for a coin the caller owns.

#### Parameters

##### address

`string`

#### Returns

`Promise`\<`AddressInfo` \| `null`\>

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

### getTransaction()?

> `optional` **getTransaction**(`txpowid`): `Promise`\<[`ChainTransaction`](ChainTransaction.md) \| `null`\>

Full transaction body by TxPoW id (OMN-074). Used to prove that a coin was
created by an expected transaction — for example that a splice successor is
an output of the splice that named it.

Optional: a provider that cannot serve transaction bodies leaves this
undefined, and callers that need provenance must fail closed rather than
assume the coin is legitimate. `MinimaRpcProvider` (any Minima/hawk node,
via the `txpow` command) and `HostedProvider` (Axia) implement it.

#### Parameters

##### txpowid

`string`

#### Returns

`Promise`\<[`ChainTransaction`](ChainTransaction.md) \| `null`\>

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
