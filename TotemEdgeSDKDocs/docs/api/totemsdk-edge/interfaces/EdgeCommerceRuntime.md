[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / EdgeCommerceRuntime

# Interface: EdgeCommerceRuntime

## Properties

### buyer

> **buyer**: [`EdgeBuyer`](../classes/EdgeBuyer.md)

The underlying buyer (advanced use).

***

### seller?

> `optional` **seller?**: [`EdgeSeller`](EdgeSeller.md)

The optional seller-side negotiation service (advanced use).

## Methods

### buy()

> **buy**(`options`): `Promise`\<[`PurchaseResult`](PurchaseResult.md)\>

#### Parameters

##### options

###### acquireBy?

`number`

###### adapter?

[`ResourceAdapter`](ResourceAdapter.md)

###### context?

`Record`\<`string`, `unknown`\>

###### intent

[`PurchaseIntent`](PurchaseIntent.md)

###### negotiation?

`Partial`\<[`NegotiationLimits`](NegotiationLimits.md)\>

###### strategy?

[`NegotiationStrategy`](NegotiationStrategy.md)

#### Returns

`Promise`\<[`PurchaseResult`](PurchaseResult.md)\>

***

### drainOutbox()

> **drainOutbox**(): `Promise`\<\{ `delivered`: `number`; `held`: `number`; `retrying`: `number`; \}\>

Drain undelivered outbox messages (bounded attempts, durable receipt).

#### Returns

`Promise`\<\{ `delivered`: `number`; `held`: `number`; `retrying`: `number`; \}\>

***

### negotiate()

> **negotiate**(`options`): `Promise`\<[`NegotiationResult`](NegotiationResult.md)\>

#### Parameters

##### options

###### desiredTerms

[`TradeTerms`](TradeTerms.md)

###### limits

`Partial`\<[`NegotiationLimits`](NegotiationLimits.md)\>

###### manifest

`SignedManifest`

###### strategy

[`NegotiationStrategy`](NegotiationStrategy.md)

#### Returns

`Promise`\<[`NegotiationResult`](NegotiationResult.md)\>

***

### recoverPurchases()

> **recoverPurchases**(): `Promise`\<`object`[]\>

Recover in-flight purchases after a restart (inspects durable state first).

#### Returns

`Promise`\<`object`[]\>

***

### startOutbox()

> **startOutbox**(`intervalMs?`): `void`

Start a periodic outbox drain loop (caller controls cadence).

#### Parameters

##### intervalMs?

`number`

#### Returns

`void`

***

### startTransport()

> **startTransport**(): `Promise`\<() => `void`\>

Start the buyer-side transport listener (when a transport is configured).

#### Returns

`Promise`\<() => `void`\>

***

### stopOutbox()

> **stopOutbox**(): `void`

Stop the periodic outbox drain loop.

#### Returns

`void`

***

### stopTransport()

> **stopTransport**(): `void`

Stop the buyer-side transport listener.

#### Returns

`void`
