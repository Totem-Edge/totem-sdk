[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / NegotiationEngineOptions

# Interface: NegotiationEngineOptions

## Properties

### limits?

> `optional` **limits?**: `Partial`\<[`NegotiationLimits`](NegotiationLimits.md)\>

Default negotiation limits.

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

### principal

> **principal**: `string`

Local principal (root identity) that owns this engine.

***

### principalStore?

> `optional` **principalStore?**: [`PrincipalNegotiationStore`](PrincipalNegotiationStore.md)

Durable principal anti-abuse store. When omitted, in-memory.

***

### sign

> **sign**: `Signer`

Signature creation (WOTS).

***

### store?

> `optional` **store?**: [`NegotiationStore`](NegotiationStore.md)

Durable negotiation store (implements atomic transitionAndEnqueue).

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
