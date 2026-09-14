[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / CreateEdgeOptions

# Interface: CreateEdgeOptions

## Properties

### adapters

> **adapters**: [`ResourceAdapter`](ResourceAdapter.md)[]

Resource adapters.

***

### authority

> **authority**: `EdgeAuthorityPort`

Authority / policy approval.

***

### commerceStore?

> `optional` **commerceStore?**: `object`

Aggregated durable commerce store (negotiations + purchases + replay +
principals + outbox in one physical backend). When supplied, it takes
precedence over the individual store options. A SQLiteCommerceStore from
@totemsdk/edge-adapters is the production reference.

#### negotiations

> **negotiations**: [`NegotiationStore`](NegotiationStore.md)

#### outbox

> **outbox**: [`OutboxStore`](OutboxStore.md)

#### principals

> **principals**: [`PrincipalNegotiationStore`](PrincipalNegotiationStore.md)

#### purchases

> **purchases**: [`PurchaseStore`](PurchaseStore.md)

#### replay

> **replay**: [`ReplayLedger`](ReplayLedger.md)

***

### hashRatePerSec?

> `optional` **hashRatePerSec?**: `number`

Hash rate for work estimation.

***

### lookup

> **lookup**: `EdgeLookupPort`

Lookup port.

***

### minimaRelay?

> `optional` **minimaRelay?**: `MinimaWorkRelay`

Minima block relay (optional — commerce still works without it).

***

### negotiationLimits?

> `optional` **negotiationLimits?**: `Partial`\<[`NegotiationLimits`](NegotiationLimits.md)\>

Negotiation limits.

***

### negotiationStore?

> `optional` **negotiationStore?**: [`NegotiationStore`](NegotiationStore.md)

Durable negotiation store (optional — in-memory dev mode).

***

### negotiationTransport?

> `optional` **negotiationTransport?**: [`NegotiationTransport`](NegotiationTransport.md)

Authenticated negotiation transport (optional — local/programmatic only).

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

### outboxStore?

> `optional` **outboxStore?**: [`OutboxStore`](OutboxStore.md)

Durable outbox store (optional — in-memory dev mode).

***

### payment

> **payment**: `EdgePaymentPort`

Payment port (idempotent).

***

### persistence?

> `optional` **persistence?**: `"ephemeral"` \| `"durable"`

Explicit persistence mode. When 'ephemeral' (or when durable stores are
not supplied), the runtime emits `runtime.persistence_ephemeral` on
startup so operators never mistake dev mode for crash guarantees.

***

### principal

> **principal**: `string`

Authenticated principal (root identity) that owns this runtime.

***

### principalStore?

> `optional` **principalStore?**: [`PrincipalNegotiationStore`](PrincipalNegotiationStore.md)

Durable principal anti-abuse store (optional — in-memory dev mode).

***

### purchaseStore?

> `optional` **purchaseStore?**: [`PurchaseStore`](PurchaseStore.md)

Durable purchase store (optional — in-memory dev mode).

***

### replayLedger?

> `optional` **replayLedger?**: [`ReplayLedger`](ReplayLedger.md)

Replay ledger (optional — in-memory dev mode).

***

### seller?

> `optional` **seller?**: `object`

Seller-side negotiation service configuration. When supplied, the runtime
also operates as a supply-side counterpart for inbound negotiation messages.

#### manifest?

> `optional` **manifest?**: `SignedManifest`\<`Manifest`\>

Standing service manifest (used to compute manifestId for opened negotiations).

#### strategy

> **strategy**: [`SellerStrategy`](SellerStrategy.md)

Seller bargaining strategy.

***

### sign

> **sign**: `Signer`

Signature creation (WOTS).

***

### templateProvider?

> `optional` **templateProvider?**: `MinimaWorkTemplateProvider`

Minima work template provider (optional — work-disabled if omitted).

***

### verifySignature

> **verifySignature**: `SignatureVerifier`

Signature verification (WOTS).

***

### workBudget?

> `optional` **workBudget?**: [`LocalWorkBudget`](LocalWorkBudget.md)

Local work budget.

***

### workDifficulty?

> `optional` **workDifficulty?**: [`WorkDifficultyPolicy`](WorkDifficultyPolicy.md)

Work difficulty policy.

***

### workMode?

> `optional` **workMode?**: [`WorkMode`](../type-aliases/WorkMode.md)

Work mode. Defaults to 'disabled' when no template provider is supplied.
