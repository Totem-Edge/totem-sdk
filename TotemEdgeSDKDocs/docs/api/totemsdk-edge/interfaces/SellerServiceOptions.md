[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / SellerServiceOptions

# Interface: SellerServiceOptions

## Properties

### limits?

> `optional` **limits?**: `Partial`\<[`NegotiationLimits`](NegotiationLimits.md)\>

Default negotiation limits.

***

### manifest?

> `optional` **manifest?**: `SignedManifest`\<`Manifest`\>

Standing service manifest (for computing manifestId when opening a negotiation).

***

### negotiationStore

> **negotiationStore**: [`NegotiationStore`](NegotiationStore.md)

Durable negotiation store.

***

### now?

> `optional` **now?**: () => `number`

Current time (for deterministic tests).

#### Returns

`number`

***

### onEvent?

> `optional` **onEvent?**: (`event`) => `void`

Event sink.

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

### outboxStore

> **outboxStore**: [`OutboxStore`](OutboxStore.md)

Durable outbox store.

***

### principal

> **principal**: `string`

Authenticated principal (root identity) that owns this seller service.

***

### principalStore

> **principalStore**: [`PrincipalNegotiationStore`](PrincipalNegotiationStore.md)

Durable principal anti-abuse store.

***

### replayLedger

> **replayLedger**: [`ReplayLedger`](ReplayLedger.md)

Durable replay ledger.

***

### sign

> **sign**: `Signer`

Signature creation (WOTS).

***

### strategy

> **strategy**: [`SellerStrategy`](SellerStrategy.md)

Seller bargaining strategy.

***

### txpow

> **txpow**: [`EdgeTxPowAdapter`](../classes/EdgeTxPowAdapter.md)

TxPoW adapter (work admission).

***

### verifySignature

> **verifySignature**: `SignatureVerifier`

Signature verification (WOTS).

***

### workPolicy

> **workPolicy**: [`EdgeWorkPolicy`](../classes/EdgeWorkPolicy.md)

Edge work policy.
