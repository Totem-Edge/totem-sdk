[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / BuyerOptions

# Interface: BuyerOptions

## Properties

### adapters

> **adapters**: [`ResourceAdapter`](ResourceAdapter.md)[]

***

### authority

> **authority**: `AuthorityPort`

***

### lookup

> **lookup**: `PurchaseLookupPort`

***

### negotiationStore?

> `optional` **negotiationStore?**: [`NegotiationStore`](NegotiationStore.md)

Durable negotiation store. When omitted, in-memory (dev mode).

***

### negotiationTransport?

> `optional` **negotiationTransport?**: [`NegotiationTransport`](NegotiationTransport.md)

Authenticated negotiation transport. When omitted, negotiation is local/programmatic.

***

### now?

> `optional` **now?**: () => `number`

#### Returns

`number`

***

### onEvent?

> `optional` **onEvent?**: (`event`) => `void`

#### Parameters

##### event

[`PurchaseEvent`](../type-aliases/PurchaseEvent.md)

#### Returns

`void`

***

### onOutboundEnqueued?

> `optional` **onOutboundEnqueued?**: () => `Promise`\<`void`\>

Optional hook invoked after a message is enqueued to the durable outbox.
The runtime uses this to trigger an immediate outbox drain over the wire.

#### Returns

`Promise`\<`void`\>

***

### outboxStore?

> `optional` **outboxStore?**: [`OutboxStore`](OutboxStore.md)

Durable outbox store. When omitted, in-memory (dev mode).

***

### payment

> **payment**: `PurchasePaymentPort`

***

### principal

> **principal**: `string`

***

### principalStore?

> `optional` **principalStore?**: [`PrincipalNegotiationStore`](PrincipalNegotiationStore.md)

Durable principal anti-abuse store. When omitted, in-memory (dev mode).

***

### providerTrust?

> `optional` **providerTrust?**: `ProviderTrustPort`

***

### purchaseStore?

> `optional` **purchaseStore?**: [`PurchaseStore`](PurchaseStore.md)

Durable purchase store. When omitted, in-memory (dev mode).

***

### replayLedger?

> `optional` **replayLedger?**: [`ReplayLedger`](ReplayLedger.md)

Durable replay ledger. When omitted, in-memory (dev mode).

***

### sign

> **sign**: `Signer`

***

### txpow

> **txpow**: [`EdgeTxPowAdapter`](../classes/EdgeTxPowAdapter.md)

***

### verifySignature

> **verifySignature**: `SignatureVerifier`

***

### workPolicy

> **workPolicy**: [`EdgeWorkPolicy`](../classes/EdgeWorkPolicy.md)
