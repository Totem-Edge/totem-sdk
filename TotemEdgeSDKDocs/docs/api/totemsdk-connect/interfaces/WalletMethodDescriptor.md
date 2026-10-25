[**@totemsdk/connect**](../index.md)

***

[@totemsdk/connect](../index.md) / WalletMethodDescriptor

# Interface: WalletMethodDescriptor

## Properties

### disposition

> `readonly` **disposition**: [`WalletMethodDisposition`](../type-aliases/WalletMethodDisposition.md)

***

### family

> `readonly` **family**: `string`

***

### method

> `readonly` **method**: `"totem_getCapabilities"` \| `"totem_getProviderStatus"` \| `"totem_setChainProvider"` \| `"totem_getWotsStatus"` \| `"totem_reserveWotsLease"` \| `"totem_releaseWotsLease"` \| `"totem_signTransaction"` \| `"totem_mineTxPoW"` \| `"totem_broadcastTxPoW"` \| `"totem_createPaymentRequest"` \| `"totem_payPaymentRequest"` \| `"totem_getTransactionStatus"` \| `"totem_getReceipt"` \| `"totem_omniaGetChannelState"` \| `"totem_omniaGetChannels"` \| `"totem_omniaOpenChannel"` \| `"totem_omniaPay"` \| `"totem_omniaSettle"` \| `"totem_omniaCloseChannel"` \| `"totem_omniaGetRoute"` \| `"totem_omniaPayMultiHop"` \| `"totem_omniaGetSwapRate"` \| `"totem_omniaCreateFactory"` \| `"totem_omniaOpenVirtualChannel"` \| `"totem_omniaCloseFactory"` \| `"totem_omniaSpliceIn"` \| `"totem_omniaSpliceOut"` \| `"totem_statechainCreate"` \| `"totem_statechainTransfer"` \| `"totem_statechainClaim"` \| `"totem_statechainVerify"` \| `"totem_kissvmSimulate"` \| `"totem_kissvmValidate"` \| `"totem_agentProposePayment"` \| `"totem_agentExplainTransaction"` \| `"totem_agentCreateReceipt"` \| `"TOTEM_CONNECT"` \| `"TOTEM_VERIFY"` \| `"TOTEM_GET_ACCOUNTS"` \| `"TOTEM_SEND_TRANSACTION"` \| `"TOTEM_TOKENCREATE"` \| `"TOTEM_GET_COINS"` \| `"TOTEM_GET_CHAIN_TIP"` \| `"TOTEM_SEND_COMPLEX"` \| `"TOTEM_SIGN_DATA"` \| `"TOTEM_SIGN_MESSAGE"` \| `"TOTEM_BROADCAST_HEX"` \| `"TOTEM_GRANT_TX_PERMISSION"` \| `"TOTEM_REVOKE_TX_PERMISSION"` \| `"TOTEM_GET_TX_PERMISSIONS"`

***

### orRequires?

> `readonly` `optional` **orRequires?**: readonly [`WalletPortKey`](../type-aliases/WalletPortKey.md)[]

Alternative port set: the method is also `supported` when every one of
these is present (e.g. Omnia via a consent client *or* a host edge port).

***

### reason?

> `readonly` `optional` **reason?**: `string`

Reason shown when the method is `unsupported`.

***

### requiredCapabilities

> `readonly` **requiredCapabilities**: readonly `string`[]

***

### requires

> `readonly` **requires**: readonly [`WalletPortKey`](../type-aliases/WalletPortKey.md)[]

Ports that must be present for the method to be `supported`.

***

### requiresApproval?

> `readonly` `optional` **requiresApproval?**: `boolean`
