[**@totemsdk/wallet-adapter**](../index.md)

***

[@totemsdk/wallet-adapter](../index.md) / WalletAdapterConfig

# Interface: WalletAdapterConfig

## Properties

### agent?

> `optional` **agent?**: `AgentBridgePort`

***

### allowExternalInputs?

> `optional` **allowExternalInputs?**: `boolean`

Allow signing inputs that are not in the connected account list.

***

### allowUntrustedOrigin?

> `optional` **allowUntrustedOrigin?**: `boolean`

Fall back to the dApp-supplied `params.origin` when no trusted origin is
available. NOT recommended; off by default.

***

### approve?

> `optional` **approve?**: (`request`) => `Promise`\<`boolean`\>

Approval callback. Required for approval-required methods; without it they
are reported unsupported (fail closed). The `origin` passed here is the
trusted origin.

#### Parameters

##### request

[`WalletAdapterApprovalRequest`](WalletAdapterApprovalRequest.md)

#### Returns

`Promise`\<`boolean`\>

***

### capabilities?

> `optional` **capabilities?**: `DeepPartial`\<`Omit`\<`TotemCapabilities`, `"version"`\>\>

***

### chain?

> `optional` **chain?**: `ChainStateProviderPort`

***

### chainProvider?

> `optional` **chainProvider?**: [`ChainProviderLike`](ChainProviderLike.md)

***

### chainProviderFactory?

> `optional` **chainProviderFactory?**: [`ChainProviderFactory`](../type-aliases/ChainProviderFactory.md)

***

### edge?

> `optional` **edge?**: `EdgeDispatchPort`

***

### getOrigin?

> `optional` **getOrigin?**: (`method?`) => `string` \| `undefined`

Trusted origin resolver. Defaults to `window.location.origin` in a browser.

#### Parameters

##### method?

`string`

#### Returns

`string` \| `undefined`

***

### handlers?

> `optional` **handlers?**: readonly `WalletMethodHandler`[]

Extra/override method handlers.

***

### kissvm?

> `optional` **kissvm?**: `KissvmClientPort`

***

### lease?

> `optional` **lease?**: `WotsLeasePort`

***

### network?

> `optional` **network?**: `string`

***

### omnia?

> `optional` **omnia?**: `OmniaClientPort`

***

### paymentRequests?

> `optional` **paymentRequests?**: `PaymentRequestPort`

***

### providerStatus?

> `optional` **providerStatus?**: `Partial`\<`TotemProviderStatus`\>

***

### receipts?

> `optional` **receipts?**: `ReceiptStorePort`

***

### selfHosted?

> `optional` **selfHosted?**: `SelfHostedPort`

***

### statechain?

> `optional` **statechain?**: `StatechainClientPort`

***

### walletInfo

> **walletInfo**: `TotemWalletInfo`
