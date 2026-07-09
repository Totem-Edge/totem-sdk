[**@totemsdk/core**](../index.md)

***

[@totemsdk/core](../index.md) / TransactionService

# Class: TransactionService

## Constructors

### Constructor

> **new TransactionService**(`http`, `config`, `logger?`, `metrics?`): `TransactionService`

#### Parameters

##### http

[`HttpClient`](../interfaces/HttpClient.md)

##### config

[`TransactionServiceConfig`](../interfaces/TransactionServiceConfig.md)

##### logger?

[`LoggerAdapter`](../interfaces/LoggerAdapter.md) = `...`

##### metrics?

[`MetricsAdapter`](../interfaces/MetricsAdapter.md) = `...`

#### Returns

`TransactionService`

## Methods

### finalize()

> **finalize**(`params`): `Promise`\<[`FinalizeResponse`](../interfaces/FinalizeResponse.md)\>

#### Parameters

##### params

[`FinalizeRequest`](../interfaces/FinalizeRequest.md)

#### Returns

`Promise`\<[`FinalizeResponse`](../interfaces/FinalizeResponse.md)\>

***

### prepare()

> **prepare**(`params`, `rootPublicKey`): `Promise`\<[`PrepareResponse`](../interfaces/PrepareResponse.md)\>

#### Parameters

##### params

[`PrepareRequest`](../interfaces/PrepareRequest.md)

##### rootPublicKey

`string`

#### Returns

`Promise`\<[`PrepareResponse`](../interfaces/PrepareResponse.md)\>

***

### sign()

> **sign**(`request`, `seed`, `_deps?`, `_paramSet?`): `Promise`\<[`SignResult`](../interfaces/SignResult.md)\>

Sign a transaction using per-address TreeKey architecture.

Produces 3 proofs (Root→L1→L2→DATA) matching Minima's TreeKey.sign() exactly.

#### Parameters

##### request

[`SignRequest`](../interfaces/SignRequest.md)

Indices and digestTx from the /prepare response

##### seed

`Uint8Array`

32-byte wallet base seed (from mnemonic)

##### \_deps?

[`WotsSigningDependencies`](../interfaces/WotsSigningDependencies.md) \| `null`

Deprecated, unused. Pass null or omit.

##### \_paramSet?

`string`

Deprecated, unused. TreeKey uses its own param set.

#### Returns

`Promise`\<[`SignResult`](../interfaces/SignResult.md)\>
