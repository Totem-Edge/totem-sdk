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

### usageStatementLog?

> `optional` **usageStatementLog?**: `UsageStatementLogStore`

Optional durable log of reconciled usage statements (Phase 3a accounting
fold). When provided, an inbound `usage.statement` is recorded exactly
once per `statementId`. When absent, the seller refuses to reconcile
statements (no silent accounting).

***

### verifySignature

> **verifySignature**: `SignatureVerifier`

Signature verification (WOTS).

***

### verifyUsageStatementAgreement?

> `optional` **verifyUsageStatementAgreement?**: (`params`) => `boolean` \| `Promise`\<`boolean`\>

Optional agreement cross-check for inbound usage statements: return true
when `agreementId` was negotiated by this seller with `buyer`. When
absent, statements are recorded without an agreement cross-check (the
fold is advisory; reimbursement/settlement stays per the agreement).

#### Parameters

##### params

###### agreementId

`string`

###### buyer

`string`

###### requestId

`string`

#### Returns

`boolean` \| `Promise`\<`boolean`\>

***

### workPolicy

> **workPolicy**: [`EdgeWorkPolicy`](../classes/EdgeWorkPolicy.md)

Edge work policy.
