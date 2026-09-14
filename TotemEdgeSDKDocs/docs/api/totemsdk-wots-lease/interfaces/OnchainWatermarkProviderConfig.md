[**@totemsdk/wots-lease**](../index.md)

***

[@totemsdk/wots-lease](../index.md) / OnchainWatermarkProviderConfig

# Interface: OnchainWatermarkProviderConfig

Layer 5 — on-chain watermark anchoring.

`chain` is any ChainStateProvider (hosted, Minima RPC, or lookup node).
The provider spends a dedicated watermark coin whose STATE(0) holds the
flat watermark cursor; every publish advances it on-chain so the watermark
is verifiable by third parties without trusting this device.

## Properties

### amount?

> `optional` **amount?**: `string`

Amount of the watermark coin in MIN base units. Default: '1'.

***

### chain

> **chain**: `object`

Chain access for coin queries, proofs, and broadcasting.

#### broadcastTxPoW()

> **broadcastTxPoW**(`txpowHex`): `Promise`\<\{ `message?`: `string`; `success`: `boolean`; `txpowid?`: `string`; \}\>

##### Parameters

###### txpowHex

`string`

##### Returns

`Promise`\<\{ `message?`: `string`; `success`: `boolean`; `txpowid?`: `string`; \}\>

#### getCoin()

> **getCoin**(`coinId`): `Promise`\<\{ `address`: `string`; `amount`: `string`; `coinid`: `string`; `state?`: `unknown`[]; `tokenid`: `string`; \} \| `null`\>

##### Parameters

###### coinId

`string`

##### Returns

`Promise`\<\{ `address`: `string`; `amount`: `string`; `coinid`: `string`; `state?`: `unknown`[]; `tokenid`: `string`; \} \| `null`\>

#### getProof()

> **getProof**(`coinId`): `Promise`\<\{ `data`: `unknown`; \}\>

##### Parameters

###### coinId

`string`

##### Returns

`Promise`\<\{ `data`: `unknown`; \}\>

#### getTip()?

> `optional` **getTip**(): `Promise`\<\{ `block`: `number`; \}\>

##### Returns

`Promise`\<\{ `block`: `number`; \}\>

***

### local

> **local**: [`LocalLeaseProvider`](../classes/LocalLeaseProvider.md)

Local provider used for the authoritative local watermark + journal.

***

### minBlocksBetweenPublishes?

> `optional` **minBlocksBetweenPublishes?**: `number`

Minimum blocks between on-chain publishes (rate limit). Default: 1.

***

### signer

> **signer**: `object`

Signer for the watermark coin's script (SIGNEDBY digest). Also authenticates issued certificates.

#### publicKeyDigest

> **publicKeyDigest**: `string`

#### sign()

> **sign**(`message`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

##### Parameters

###### message

`Uint8Array`

##### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

#### verify()?

> `optional` **verify**(`message`, `signature`): `Promise`\<`boolean`\>

##### Parameters

###### message

`Uint8Array`

###### signature

`Uint8Array`

##### Returns

`Promise`\<`boolean`\>

***

### statePort?

> `optional` **statePort?**: `number`

Port holding the flat watermark cursor in the coin state. Default: 0.

***

### storage?

> `optional` **storage?**: `StorageAdapter`

Optional durable storage for the watermark coin's identity. When set, the
provider persists the advanced watermark coin ID after each publish so the
rollover survives restarts. Default: in-memory only.

***

### tokenId?

> `optional` **tokenId?**: `string`

Token ID of the watermark coin. Default: '0x00'.

***

### watermarkAddress

> **watermarkAddress**: `string`

Address the watermark coin currently sits at (spending address).

***

### watermarkCoinId

> **watermarkCoinId**: `string`

Coin ID of the dedicated watermark coin.
