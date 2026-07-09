[**@totemsdk/pureminima-rpc**](../index.md)

***

[@totemsdk/pureminima-rpc](../index.md) / PureMinimaClient

# Interface: PureMinimaClient

## Methods

### balance()

> **balance**(`params?`): `Promise`\<[`Balance`](Balance.md)[]\>

#### Parameters

##### params?

[`BalanceQuery`](BalanceQuery.md)

#### Returns

`Promise`\<[`Balance`](Balance.md)[]\>

***

### burn()

> **burn**(`last?`): `Promise`\<[`BurnInfo`](BurnInfo.md)\>

#### Parameters

##### last?

`number`

#### Returns

`Promise`\<[`BurnInfo`](BurnInfo.md)\>

***

### coinCheck()

> **coinCheck**(`coinId`): `Promise`\<[`CoinCheckResult`](CoinCheckResult.md)\>

#### Parameters

##### coinId

`string`

#### Returns

`Promise`\<[`CoinCheckResult`](CoinCheckResult.md)\>

***

### coinExport()

> **coinExport**(`coinId`): `Promise`\<[`CoinExportResult`](CoinExportResult.md)\>

#### Parameters

##### coinId

`string`

#### Returns

`Promise`\<[`CoinExportResult`](CoinExportResult.md)\>

***

### coins()

> **coins**(`query?`): `Promise`\<[`Coin`](Coin.md)[]\>

#### Parameters

##### query?

[`CoinsQuery`](CoinsQuery.md)

#### Returns

`Promise`\<[`Coin`](Coin.md)[]\>

***

### getAddress()

> **getAddress**(): `Promise`\<[`AddressInfo`](AddressInfo.md)\>

#### Returns

`Promise`\<[`AddressInfo`](AddressInfo.md)\>

***

### getTip()

> **getTip**(): `Promise`\<[`ChainTip`](ChainTip.md)\>

#### Returns

`Promise`\<[`ChainTip`](ChainTip.md)\>

***

### history()

> **history**(`params?`): `Promise`\<[`HistoryEntry`](HistoryEntry.md)[]\>

#### Parameters

##### params?

[`HistoryQuery`](HistoryQuery.md)

#### Returns

`Promise`\<[`HistoryEntry`](HistoryEntry.md)[]\>

***

### megammr()

> **megammr**(): `Promise`\<[`MegaMMRInfo`](MegaMMRInfo.md)\>

#### Returns

`Promise`\<[`MegaMMRInfo`](MegaMMRInfo.md)\>

***

### mmrProof()

> **mmrProof**(`coinId`): `Promise`\<[`MMRProof`](MMRProof.md)\>

#### Parameters

##### coinId

`string`

#### Returns

`Promise`\<[`MMRProof`](MMRProof.md)\>

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

> **send**(`params`): `Promise`\<[`TxnPostResult`](TxnPostResult.md)\>

#### Parameters

##### params

[`SendParams`](SendParams.md)

#### Returns

`Promise`\<[`TxnPostResult`](TxnPostResult.md)\>

***

### status()

> **status**(): `Promise`\<[`NodeStatus`](NodeStatus.md)\>

#### Returns

`Promise`\<[`NodeStatus`](NodeStatus.md)\>

***

### tokens()

> **tokens**(`tokenId?`, `action?`): `Promise`\<[`TokenInfo`](TokenInfo.md)[]\>

#### Parameters

##### tokenId?

`string`

##### action?

`string`

#### Returns

`Promise`\<[`TokenInfo`](TokenInfo.md)[]\>

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

> **txnCheck**(`id`): `Promise`\<[`TxnCheckResult`](TxnCheckResult.md)\>

#### Parameters

##### id

`string`

#### Returns

`Promise`\<[`TxnCheckResult`](TxnCheckResult.md)\>

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

[`TxnInputParams`](TxnInputParams.md)

#### Returns

`Promise`\<`void`\>

***

### txnList()

> **txnList**(`id?`, `transactionOnly?`): `Promise`\<[`TxnListResult`](TxnListResult.md)\>

#### Parameters

##### id?

`string`

##### transactionOnly?

`boolean`

#### Returns

`Promise`\<[`TxnListResult`](TxnListResult.md)\>

***

### txnMine()

> **txnMine**(`params`): `Promise`\<`void`\>

#### Parameters

##### params

[`TxnMineParams`](TxnMineParams.md)

#### Returns

`Promise`\<`void`\>

***

### txnMinePost()

> **txnMinePost**(`data`): `Promise`\<[`TxnPostResult`](TxnPostResult.md)\>

#### Parameters

##### data

`string`

#### Returns

`Promise`\<[`TxnPostResult`](TxnPostResult.md)\>

***

### txnOutput()

> **txnOutput**(`params`): `Promise`\<`void`\>

#### Parameters

##### params

[`TxnOutputParams`](TxnOutputParams.md)

#### Returns

`Promise`\<`void`\>

***

### txnPost()

> **txnPost**(`params`): `Promise`\<[`TxnPostResult`](TxnPostResult.md)\>

#### Parameters

##### params

[`TxnPostParams`](TxnPostParams.md)

#### Returns

`Promise`\<[`TxnPostResult`](TxnPostResult.md)\>

***

### txnScript()

> **txnScript**(`params`): `Promise`\<`void`\>

#### Parameters

##### params

[`TxnScriptParams`](TxnScriptParams.md)

#### Returns

`Promise`\<`void`\>

***

### txnSign()

> **txnSign**(`params`): `Promise`\<`void`\>

#### Parameters

##### params

[`TxnSignParams`](TxnSignParams.md)

#### Returns

`Promise`\<`void`\>

***

### txnState()

> **txnState**(`params`): `Promise`\<`void`\>

#### Parameters

##### params

[`TxnStateParams`](TxnStateParams.md)

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

> **webhooks**(`action`): `Promise`\<[`WebhookEntry`](WebhookEntry.md)[]\>

##### Parameters

###### action

`"list"`

##### Returns

`Promise`\<[`WebhookEntry`](WebhookEntry.md)[]\>

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
