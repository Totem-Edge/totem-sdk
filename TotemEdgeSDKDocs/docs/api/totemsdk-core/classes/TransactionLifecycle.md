[**@totemsdk/core**](../index.md)

***

[@totemsdk/core](../index.md) / TransactionLifecycle

# Class: TransactionLifecycle

## Constructors

### Constructor

> **new TransactionLifecycle**(`txService`, `leaseStore`, `watermarkStore`, `receiptStore`, `logger?`, `metrics?`, `config?`): `TransactionLifecycle`

#### Parameters

##### txService

[`TransactionService`](TransactionService.md)

##### leaseStore

[`LeaseStore`](LeaseStore.md)

##### watermarkStore

[`WatermarkStore`](WatermarkStore.md)

##### receiptStore

[`TransactionReceiptStore`](TransactionReceiptStore.md)

##### logger?

[`LoggerAdapter`](../interfaces/LoggerAdapter.md) = `...`

##### metrics?

[`MetricsAdapter`](../interfaces/MetricsAdapter.md) = `...`

##### config?

[`TransactionLifecycleConfig`](../interfaces/TransactionLifecycleConfig.md) = `{}`

#### Returns

`TransactionLifecycle`

## Methods

### cancelLease()

> **cancelLease**(`leaseToken`): `Promise`\<`void`\>

#### Parameters

##### leaseToken

`string`

#### Returns

`Promise`\<`void`\>

***

### finalize()

> **finalize**(`leaseToken`, `signedHex`, `metadata`): `Promise`\<[`FinalizeResponse`](../interfaces/FinalizeResponse.md)\>

#### Parameters

##### leaseToken

`string`

##### signedHex

`string`

##### metadata

[`TransactionMetadata`](../interfaces/TransactionMetadata.md)

#### Returns

`Promise`\<[`FinalizeResponse`](../interfaces/FinalizeResponse.md)\>

***

### prepare()

> **prepare**(`params`, `rootPublicKey`): `Promise`\<[`PrepareResult`](../interfaces/PrepareResult.md)\>

#### Parameters

##### params

[`PrepareRequest`](../interfaces/PrepareRequest.md)

##### rootPublicKey

`string`

#### Returns

`Promise`\<[`PrepareResult`](../interfaces/PrepareResult.md)\>

***

### setSyncWatermarkFunction()

> **setSyncWatermarkFunction**(`fn`): `void`

#### Parameters

##### fn

[`WatermarkSyncFunction`](../interfaces/WatermarkSyncFunction.md)

#### Returns

`void`

***

### sign()

> **sign**(`prepareResult`, `seed`, `deps`, `paramSetName?`): `Promise`\<[`SignResult`](../interfaces/SignResult.md)\>

#### Parameters

##### prepareResult

[`PrepareResult`](../interfaces/PrepareResult.md)

##### seed

`Uint8Array`

##### deps

[`WotsSigningDependencies`](../interfaces/WotsSigningDependencies.md)

##### paramSetName?

`string`

#### Returns

`Promise`\<[`SignResult`](../interfaces/SignResult.md)\>
