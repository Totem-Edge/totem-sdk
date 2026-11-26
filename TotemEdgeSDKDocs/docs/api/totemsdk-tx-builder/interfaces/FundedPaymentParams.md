[**@totemsdk/tx-builder**](../index.md)

***

[@totemsdk/tx-builder](../index.md) / FundedPaymentParams

# Interface: FundedPaymentParams

## Properties

### amount

> **amount**: `string`

***

### changeAddress?

> `optional` **changeAddress?**: `string`

Where token/fee change goes. Defaults to the first owner address.

***

### feeAmount?

> `optional` **feeAmount?**: `string`

Native fee coin amount. When paying a token, a separate native coin of at
least this amount is selected and returned as change.

***

### feeCoinId?

> `optional` **feeCoinId?**: `string`

Explicit fee coin id (skips fee selection).

***

### fetchProofs?

> `optional` **fetchProofs?**: `boolean`

Fetch `coinexport` proofs for inputs when the provider supports it.

***

### ownerAddresses

> **ownerAddresses**: `string`[]

Addresses that may fund the payment.

***

### ownerPublicKey

> **ownerPublicKey**: `string`

Public key used for the default `RETURN SIGNEDBY(pubkey)` input descriptor.

***

### provider

> **provider**: [`CoinProvider`](CoinProvider.md)

***

### recipient

> **recipient**: `string`

***

### scriptDescriptorFor?

> `optional` **scriptDescriptorFor?**: (`coin`) => `ScriptDescriptor`

Custom descriptor for non-standard inputs (HTLC/MAST/etc.).

#### Parameters

##### coin

[`TxCoin`](TxCoin.md)

#### Returns

`ScriptDescriptor`

***

### tokenId?

> `optional` **tokenId?**: `string`

Token to pay. Defaults to native MINIMA (`0x00`).
