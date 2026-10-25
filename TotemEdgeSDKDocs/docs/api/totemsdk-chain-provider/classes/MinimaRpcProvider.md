[**@totemsdk/chain-provider**](../index.md)

***

[@totemsdk/chain-provider](../index.md) / MinimaRpcProvider

# Class: MinimaRpcProvider

Optional funding-truth extension port. Providers that can attest deposits
implement this; `withDepositVerifier(provider)` provides a default that uses
the base provider's `getCoin` for the live path.

## Implements

- [`ChainStateProvider`](../interfaces/ChainStateProvider.md)
- [`DepositVerifier`](../interfaces/DepositVerifier.md)

## Constructors

### Constructor

> **new MinimaRpcProvider**(`client`): `MinimaRpcProvider`

#### Parameters

##### client

`MinimaRpcClient`

#### Returns

`MinimaRpcProvider`

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

### depositAddressFor()

> **depositAddressFor**(`lp`, `opts?`): `string`

Deterministic deposit address the LP funds the pool/channel from.

#### Parameters

##### lp

`string`

##### opts?

###### poolId?

`string`

###### tokenId?

`string`

#### Returns

`string`

#### Implementation of

[`DepositVerifier`](../interfaces/DepositVerifier.md).[`depositAddressFor`](../interfaces/DepositVerifier.md#depositaddressfor)

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

### getMinTxPowWork()

> **getMinTxPowWork**(): `Promise`\<`string` \| `null`\>

Current minimum TxPoW work from the tip block's Magic numbers (`magic`
command). This is the live target locally mined transactions must meet;
using it avoids hardcoding a difficulty that may be harder than the
network currently requires (or easier than it has drifted to).

#### Returns

`Promise`\<`string` \| `null`\>

#### Implementation of

[`ChainStateProvider`](../interfaces/ChainStateProvider.md).[`getMinTxPowWork`](../interfaces/ChainStateProvider.md#getmintxpowwork)

***

### getMmrRoot()

> **getMmrRoot**(): `Promise`\<`string` \| `null`\>

MMR root at tip — the anchor peers verify offline proofs against.

#### Returns

`Promise`\<`string` \| `null`\>

#### Implementation of

[`DepositVerifier`](../interfaces/DepositVerifier.md).[`getMmrRoot`](../interfaces/DepositVerifier.md#getmmrroot)

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

***

### submitTransaction()

> **submitTransaction**(`txBytes`, `witnessBytes`, `id?`): `Promise`\<[`BroadcastResult`](../interfaces/BroadcastResult.md)\>

Submit a raw transaction + witness via the node's explicit-mine path.

`sendtransaction` only adds a pre-built TxPoW to the mempool; a TxPoW built
outside the node has a placeholder header (block number 0, block difficulty
MAX_HASH), which the node's block builder does not reliably promote. The
node's own `txnmine` builds the header with the real tip fields and mines
it. We then post that mined TxPoW with `sendtransaction`.

TxnRow wire format (Java/C++): MiniString(id) || Transaction || Witness.

#### Parameters

##### txBytes

`Uint8Array`

##### witnessBytes

`Uint8Array`

##### id?

`string` = `...`

#### Returns

`Promise`\<[`BroadcastResult`](../interfaces/BroadcastResult.md)\>

#### Implementation of

[`ChainStateProvider`](../interfaces/ChainStateProvider.md).[`submitTransaction`](../interfaces/ChainStateProvider.md#submittransaction)

***

### verifyDeposit()

> **verifyDeposit**(`params`): `Promise`\<[`DepositVerification`](../interfaces/DepositVerification.md)\>

Authoritative live check via `coinexport` (the coinproof endpoint): returns
found/unspent/owned/token/amount + the full coin proof. `coincheck` on
totem-node wants a full proof payload rather than a coinid, so coinexport
is the canonical primitive (#3).

#### Parameters

##### params

[`VerifyDepositParams`](../interfaces/VerifyDepositParams.md)

#### Returns

`Promise`\<[`DepositVerification`](../interfaces/DepositVerification.md)\>

#### Implementation of

[`DepositVerifier`](../interfaces/DepositVerifier.md).[`verifyDeposit`](../interfaces/DepositVerifier.md#verifydeposit)
