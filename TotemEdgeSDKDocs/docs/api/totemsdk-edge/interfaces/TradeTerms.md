[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / TradeTerms

# Interface: TradeTerms

Resource-generic trade terms.

Supports machine negotiations over price, quantity, duration, unit, latency,
location, payment asset, payment method, settlement interval, proof
requirements, SLA, priority, availability window, quality, and cancellation.
Uses typed extensibility via `extras` rather than an unrestricted giant
Record<string, unknown>.

## Properties

### availabilityWindowMs?

> `optional` **availabilityWindowMs?**: \[`number`, `number`\]

Availability window [startMs, endMs].

***

### cancellationPolicy?

> `optional` **cancellationPolicy?**: `string`

Cancellation policy label.

***

### durationMs?

> `optional` **durationMs?**: `number`

Duration in milliseconds.

***

### extras?

> `optional` **extras?**: `Record`\<`string`, `string`\>

Typed extensibility — domain-specific terms.

***

### location?

> `optional` **location?**: `string`

Geographic region / location constraint.

***

### maxLatencyMs?

> `optional` **maxLatencyMs?**: `number`

Maximum acceptable latency in milliseconds.

***

### paymentMethod?

> `optional` **paymentMethod?**: `string`

Payment method (e.g. 'omnia', 'onchain', 'invoice', 'free').

***

### price

> **price**: `string`

Price in the token's native unit (string to preserve precision).

***

### priority?

> `optional` **priority?**: `number`

Priority level.

***

### proofRequirements?

> `optional` **proofRequirements?**: `string`[]

Proof requirements (e.g. 'location-proof', 'none').

***

### quality?

> `optional` **quality?**: `string`

Quality level.

***

### quantity?

> `optional` **quantity?**: `object`

#### amount

> **amount**: `string`

#### unit

> **unit**: `string`

***

### settlementIntervalMs?

> `optional` **settlementIntervalMs?**: `number`

Settlement interval in milliseconds.

***

### sla?

> `optional` **sla?**: `string`

Service-level agreement label.

***

### tokenId?

> `optional` **tokenId?**: `string`

Minima tokenId, or '0x00' for native Minima.
