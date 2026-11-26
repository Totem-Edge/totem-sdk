[**@totemsdk/chain-provider**](../index.md)

***

[@totemsdk/chain-provider](../index.md) / MinimaRpcClient

# Interface: MinimaRpcClient

## Methods

### addressInfo()

> **addressInfo**(`address`): `Promise`\<`AddressInfo`\>

`getaddressinfo` — public key + address script for an address.

#### Parameters

##### address

`string`

#### Returns

`Promise`\<`AddressInfo`\>

***

### balance()

> **balance**(`params?`): `Promise`\<`Balance`[]\>

#### Parameters

##### params?

`BalanceQuery`

#### Returns

`Promise`\<`Balance`[]\>

***

### burn()

> **burn**(): `Promise`\<`BurnInfo`\>

#### Returns

`Promise`\<`BurnInfo`\>

***

### coinCheck()

> **coinCheck**(`data`): `Promise`\<`CoinCheckResult`\>

`coincheck data:` — pass the CoinProof hex from `coinexport`.

#### Parameters

##### data

`string`

#### Returns

`Promise`\<`CoinCheckResult`\>

***

### coinExport()

> **coinExport**(`coinId`): `Promise`\<`CoinExportResult`\>

#### Parameters

##### coinId

`string`

#### Returns

`Promise`\<`CoinExportResult`\>

***

### coins()

> **coins**(`query?`): `Promise`\<`Coin`[]\>

#### Parameters

##### query?

`CoinsQuery`

#### Returns

`Promise`\<`Coin`[]\>

***

### getAddress()

> **getAddress**(): `Promise`\<`AddressInfo`\>

#### Returns

`Promise`\<`AddressInfo`\>

***

### getTip()

> **getTip**(): `Promise`\<`ChainTip`\>

#### Returns

`Promise`\<`ChainTip`\>

***

### history()

> **history**(`params?`): `Promise`\<`HistoryEntry`[]\>

#### Parameters

##### params?

`HistoryQuery`

#### Returns

`Promise`\<`HistoryEntry`[]\>

***

### magic()

> **magic**(): `Promise`\<`MagicInfo`\>

`magic` — current network Magic numbers (incl. `currentmintxpowwork`).

#### Returns

`Promise`\<`MagicInfo`\>

***

### megammr()

> **megammr**(): `Promise`\<`MegaMMRInfo`\>

#### Returns

`Promise`\<`MegaMMRInfo`\>

***

### mmrProof()

> **mmrProof**(`coinId`): `Promise`\<`MMRProof`\>

#### Parameters

##### coinId

`string`

#### Returns

`Promise`\<`MMRProof`\>

***

### newAddress()

> **newAddress**(`params?`): `Promise`\<`AddressInfo`\>

`newaddress` — optionally with a `modifier:` for deterministic derivation.

#### Parameters

##### params?

###### modifier?

`string`

#### Returns

`Promise`\<`AddressInfo`\>

***

### probeDeterministicAddress()

> **probeDeterministicAddress**(`modifier?`): `Promise`\<`AddressModifierProbe`\>

Probe whether this node honours `newaddress modifier:` — i.e. returns the
same address for the same modifier twice. `supported:false` means the node
ignores the modifier (or has no such command), so callers must not trust a
node-returned deterministic address (use `@totemsdk/core` derivation).

#### Parameters

##### modifier?

`string`

#### Returns

`Promise`\<`AddressModifierProbe`\>

***

### runCommand()

> **runCommand**(`cmd`, `params?`): `Promise`\<`unknown`\>

#### Parameters

##### cmd

`string`

##### params?

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`unknown`\>

***

### send()

> **send**(`params`): `Promise`\<`TxnPostResult`\>

`send` — supports stateful sends. `state` is serialized as the node's
`state:{"port":"value"}` parameter and `storestate` is passed through.

#### Parameters

##### params

`SendParams`

#### Returns

`Promise`\<`TxnPostResult`\>

***

### sendTransaction()

> **sendTransaction**(`data`): `Promise`\<`TxnPostResult`\>

`txnmine` — mine a TxnRow (ID + Transaction + Witness) using the node's
own header (correct block number/difficulty/magic) and return the mined
TxPoW hex. Unlike `sendtransaction`, this does not post it.

#### Parameters

##### data

`string`

#### Returns

`Promise`\<`TxnPostResult`\>

***

### status()

> **status**(): `Promise`\<`NodeStatus`\>

#### Returns

`Promise`\<`NodeStatus`\>

***

### tokens()

> **tokens**(`tokenId?`, `action?`): `Promise`\<`TokenInfo`[]\>

#### Parameters

##### tokenId?

`string`

##### action?

`string`

#### Returns

`Promise`\<`TokenInfo`[]\>

***

### txnBasics()

> **txnBasics**(`id`): `Promise`\<`void`\>

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`void`\>

***

### txnCheck()

> **txnCheck**(`id`): `Promise`\<`TxnCheckResult`\>

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`TxnCheckResult`\>

***

### txnClear()

> **txnClear**(`id`): `Promise`\<`void`\>

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`void`\>

***

### txnCreate()

> **txnCreate**(`id`): `Promise`\<`void`\>

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`void`\>

***

### txnDelete()

> **txnDelete**(`id`): `Promise`\<`void`\>

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`void`\>

***

### txnExport()

> **txnExport**(`id`): `Promise`\<`string`\>

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`string`\>

***

### txnImport()

> **txnImport**(`data`, `id?`): `Promise`\<`void`\>

#### Parameters

##### data

`string`

##### id?

`string`

#### Returns

`Promise`\<`void`\>

***

### txnInput()

> **txnInput**(`params`): `Promise`\<`void`\>

#### Parameters

##### params

`TxnInputParams`

#### Returns

`Promise`\<`void`\>

***

### txnList()

> **txnList**(`id?`, `transactionOnly?`): `Promise`\<`TxnListResult`\>

#### Parameters

##### id?

`string`

##### transactionOnly?

`boolean`

#### Returns

`Promise`\<`TxnListResult`\>

***

### txnMine()

> **txnMine**(`params`): `Promise`\<\{ `data?`: `string`; `txpowid?`: `string`; \}\>

#### Parameters

##### params

`TxnMineParams`

#### Returns

`Promise`\<\{ `data?`: `string`; `txpowid?`: `string`; \}\>

***

### txnMinePost()

> **txnMinePost**(`data`): `Promise`\<`TxnPostResult`\>

#### Parameters

##### data

`string`

#### Returns

`Promise`\<`TxnPostResult`\>

***

### txnOutput()

> **txnOutput**(`params`): `Promise`\<`void`\>

#### Parameters

##### params

`TxnOutputParams`

#### Returns

`Promise`\<`void`\>

***

### txnPost()

> **txnPost**(`params`): `Promise`\<`TxnPostResult`\>

#### Parameters

##### params

`TxnPostParams`

#### Returns

`Promise`\<`TxnPostResult`\>

***

### txnScript()

> **txnScript**(`params`): `Promise`\<`void`\>

#### Parameters

##### params

`TxnScriptParams`

#### Returns

`Promise`\<`void`\>

***

### txnSign()

> **txnSign**(`params`): `Promise`\<`void`\>

#### Parameters

##### params

`TxnSignParams`

#### Returns

`Promise`\<`void`\>

***

### txnState()

> **txnState**(`params`): `Promise`\<`void`\>

#### Parameters

##### params

`TxnStateParams`

#### Returns

`Promise`\<`void`\>

***

### verify()

> **verify**(`publicKey`, `data`, `signature`): `Promise`\<`boolean`\>

#### Parameters

##### publicKey

`string`

##### data

`string`

##### signature

`string`

#### Returns

`Promise`\<`boolean`\>

***

### webhooks()

#### Call Signature

> **webhooks**(`action`): `Promise`\<`WebhookEntry`[]\>

##### Parameters

###### action

`"list"`

##### Returns

`Promise`\<`WebhookEntry`[]\>

#### Call Signature

> **webhooks**(`action`, `hook`, `filter`): `Promise`\<`void`\>

##### Parameters

###### action

`"add"`

###### hook

`string`

###### filter

`"NEWTXPOW"` \| `"NEWBLOCK"`

##### Returns

`Promise`\<`void`\>

#### Call Signature

> **webhooks**(`action`, `hook`): `Promise`\<`void`\>

##### Parameters

###### action

`"remove"`

###### hook

`string`

##### Returns

`Promise`\<`void`\>
