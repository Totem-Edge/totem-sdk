[**@totemsdk/connect**](../index.md)

***

[@totemsdk/connect](../index.md) / WalletHandlerContext

# Interface: WalletHandlerContext

## Properties

### agent?

> `readonly` `optional` **agent?**: [`AgentBridgePort`](AgentBridgePort.md)

***

### approvals?

> `readonly` `optional` **approvals?**: [`ApprovalPort`](ApprovalPort.md)

***

### chain?

> `readonly` `optional` **chain?**: [`ChainStateProviderPort`](ChainStateProviderPort.md)

***

### edge?

> `readonly` `optional` **edge?**: [`EdgeDispatchPort`](EdgeDispatchPort.md)

***

### info

> `readonly` **info**: [`WalletInfoPort`](WalletInfoPort.md)

***

### kissvm?

> `readonly` `optional` **kissvm?**: [`KissvmClientPort`](KissvmClientPort.md)

***

### lease?

> `readonly` `optional` **lease?**: [`WotsLeasePort`](WotsLeasePort.md)

***

### now?

> `readonly` `optional` **now?**: () => `number`

#### Returns

`number`

***

### omnia?

> `readonly` `optional` **omnia?**: [`OmniaClientPort`](OmniaClientPort.md)

***

### paymentRequests?

> `readonly` `optional` **paymentRequests?**: [`PaymentRequestPort`](PaymentRequestPort.md)

***

### receipts?

> `readonly` `optional` **receipts?**: [`ReceiptStorePort`](ReceiptStorePort.md)

***

### selfHosted?

> `readonly` `optional` **selfHosted?**: [`SelfHostedPort`](SelfHostedPort.md)

***

### signer?

> `readonly` `optional` **signer?**: [`WalletSignerPort`](WalletSignerPort.md)

***

### statechain?

> `readonly` `optional` **statechain?**: [`StatechainClientPort`](StatechainClientPort.md)
