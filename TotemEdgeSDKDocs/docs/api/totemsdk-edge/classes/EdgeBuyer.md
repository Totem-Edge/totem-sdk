[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / EdgeBuyer

# Class: EdgeBuyer

## Constructors

### Constructor

> **new EdgeBuyer**(`opts`): `EdgeBuyer`

#### Parameters

##### opts

[`BuyerOptions`](../interfaces/BuyerOptions.md)

#### Returns

`EdgeBuyer`

## Accessors

### engine

#### Get Signature

> **get** **engine**(): [`NegotiationEngine`](NegotiationEngine.md)

The underlying negotiation engine. Exposed so a seller-side runtime can
wire inbound authenticated transport messages into the same engine that
drives purchases. The engine remains the deterministic economic state
machine; transport stays separate.

##### Returns

[`NegotiationEngine`](NegotiationEngine.md)

## Methods

### buy()

> **buy**(`options`): `Promise`\<[`PurchaseResult`](../interfaces/PurchaseResult.md)\>

edge.buy() — resource-generic demand orchestration.

#### Parameters

##### options

[`BuyOptions`](../interfaces/BuyOptions.md)

#### Returns

`Promise`\<[`PurchaseResult`](../interfaces/PurchaseResult.md)\>

***

### enqueueMessage()

> **enqueueMessage**(`recipient`, `message`): `Promise`\<`void`\>

Enqueue a signed protocol message into the durable outbox.
Exposed for the runtime-level outbox drainer to send.

#### Parameters

##### recipient

`string`

##### message

[`NegotiationMessage`](../type-aliases/NegotiationMessage.md)

#### Returns

`Promise`\<`void`\>

***

### handleInbound()

> **handleInbound**(`message`, `context`): `Promise`\<[`ReplayOutcome`](../interfaces/ReplayOutcome.md)\>

Handle an inbound authenticated negotiation message.
Used by the transport-driven negotiation loop.

#### Parameters

##### message

[`NegotiationMessage`](../type-aliases/NegotiationMessage.md)

##### context

[`TransportMessageContext`](../interfaces/TransportMessageContext.md)

#### Returns

`Promise`\<[`ReplayOutcome`](../interfaces/ReplayOutcome.md)\>

***

### negotiate()

> **negotiate**(`options`): `Promise`\<[`NegotiationResult`](../interfaces/NegotiationResult.md)\>

edge.negotiate() — bounded peer-to-peer negotiation.

When a negotiation transport is configured, this method becomes
transport-driven: the initial proposal is sent over the wire and the
service waits for seller responses. When no transport is configured,
negotiation is local/programmatic (used for deterministic tests and
co-located runtimes).

#### Parameters

##### options

###### desiredTerms

[`TradeTerms`](../interfaces/TradeTerms.md)

###### limits

`Partial`\<[`NegotiationLimits`](../interfaces/NegotiationLimits.md)\>

###### manifest

`SignedManifest`

###### strategy

[`NegotiationStrategy`](../interfaces/NegotiationStrategy.md)

#### Returns

`Promise`\<[`NegotiationResult`](../interfaces/NegotiationResult.md)\>

***

### reconcilePrincipalSlots()

> **reconcilePrincipalSlots**(): `Promise`\<`void`\>

Reconcile principal admission slots against active negotiations after a
restart. Any slot whose negotiation is terminal/expired/missing is
released, preventing capacity leaks from crashed processes.

#### Returns

`Promise`\<`void`\>

***

### recoverResource()

> **recoverResource**(`purchaseId`): `Promise`\<[`PurchaseSession`](../interfaces/PurchaseSession.md) \| `null`\>

Recover a purchase's resource after a restart. Looks up the durable
purchase record, and if a resource reference is persisted, reconnects via
the adapter's recover() hook — never starting another identical resource.

Returns the recovered session, or null when the purchase has no persisted
resource reference (nothing to recover).

#### Parameters

##### purchaseId

`string`

#### Returns

`Promise`\<[`PurchaseSession`](../interfaces/PurchaseSession.md) \| `null`\>

***

### startTransport()

> **startTransport**(): `Promise`\<() => `void`\>

Start listening on the negotiation transport (idempotent).

#### Returns

`Promise`\<() => `void`\>

***

### stopTransport()

> **stopTransport**(): `void`

Stop listening on the negotiation transport.

#### Returns

`void`
