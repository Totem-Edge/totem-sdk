[**@totemsdk/chain-provider**](../index.md)

***

[@totemsdk/chain-provider](../index.md) / DepositVerifier

# Interface: DepositVerifier

Optional funding-truth extension port. Providers that can attest deposits
implement this; `withDepositVerifier(provider)` provides a default that uses
the base provider's `getCoin` for the live path.

## Methods

### depositAddressFor()

> **depositAddressFor**(`lp`, `opts?`): `string`

Deterministic deposit address the LP funds the pool/channel from.

#### Parameters

##### lp

`string`

##### opts?

[`DepositAddressOptions`](DepositAddressOptions.md)

#### Returns

`string`

***

### getMmrRoot()

> **getMmrRoot**(): `Promise`\<`string` \| `null`\>

Chain MMR root for offline proof verification; null when unavailable.

#### Returns

`Promise`\<`string` \| `null`\>

***

### verifyDeposit()

> **verifyDeposit**(`params`): `Promise`\<[`DepositVerification`](DepositVerification.md)\>

#### Parameters

##### params

[`VerifyDepositParams`](VerifyDepositParams.md)

#### Returns

`Promise`\<[`DepositVerification`](DepositVerification.md)\>

***

### verifyMmrDeposit()?

> `optional` **verifyMmrDeposit**(`params`): `Promise`\<`boolean`\>

Offline (root-anchored) proof check; falls back to the live path when absent.

#### Parameters

##### params

###### expectedRoot

`Uint8Array`

###### leafPubkey

`Uint8Array`

###### proof

[`MmrChunkProof`](MmrChunkProof.md)

#### Returns

`Promise`\<`boolean`\>
