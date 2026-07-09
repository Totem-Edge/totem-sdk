[**@totemsdk/node**](../index.md)

***

[@totemsdk/node](../index.md) / TotemSendTransactionRequest

# Interface: TotemSendTransactionRequest

## Properties

### burn?

> `optional` **burn?**: `string`

***

### contract?

> `optional` **contract?**: [`DAppContractCallParams`](DAppContractCallParams.md)

***

### htlc?

> `optional` **htlc?**: [`DAppHtlcParams`](DAppHtlcParams.md)

***

### inputs?

> `optional` **inputs?**: [`DAppTransactionInput`](DAppTransactionInput.md)[]

***

### intent

> **intent**: [`DAppTransactionIntent`](../type-aliases/DAppTransactionIntent.md)

***

### liquidity?

> `optional` **liquidity?**: [`DAppLiquidityParams`](DAppLiquidityParams.md)

***

### memo?

> `optional` **memo?**: `string`

***

### metadata?

> `optional` **metadata?**: `object`

#### appName?

> `optional` **appName?**: `string`

#### description?

> `optional` **description?**: `string`

#### iconUrl?

> `optional` **iconUrl?**: `string`

***

### multisig?

> `optional` **multisig?**: [`DAppMultisigParams`](DAppMultisigParams.md)

***

### options?

> `optional` **options?**: `object`

#### excludeAddresses?

> `optional` **excludeAddresses?**: `string`[]

#### skipPreview?

> `optional` **skipPreview?**: `boolean`

#### useSourceAddress?

> `optional` **useSourceAddress?**: `string`

#### verifyWithTotemidea?

> `optional` **verifyWithTotemidea?**: `boolean`

***

### outputs

> **outputs**: [`DAppTransactionOutput`](DAppTransactionOutput.md)[]

***

### swap?

> `optional` **swap?**: [`DAppSwapParams`](DAppSwapParams.md)

***

### timelock?

> `optional` **timelock?**: [`DAppTimelockParams`](DAppTimelockParams.md)

***

### version

> **version**: `1`
