[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / PurchaseRecord

# Interface: PurchaseRecord

A durable purchase record.

`idempotencyKeys` records the stable operation identities already issued
(payment, resource-start, settlement, receipt) so retries never duplicate
side effects.

## Properties

### acquireBy?

> `optional` **acquireBy?**: `number`

Absolute acquisition deadline (persisted, not a relative timer).

***

### agreement?

> `optional` **agreement?**: [`TradeAgreement`](TradeAgreement.md)

***

### createdAt

> **createdAt**: `number`

***

### idempotencyKeys

> **idempotencyKeys**: `string`[]

Stable idempotency keys already issued.

***

### intent

> **intent**: [`PurchaseIntent`](PurchaseIntent.md)

***

### purchaseId

> **purchaseId**: `string`

***

### resourceReference?

> `optional` **resourceReference?**: `string`

Resource handle reference (only if safe/meaningful to persist).

***

### revision

> **revision**: `number`

Monotonically increasing revision for atomic CAS transitions.

***

### status

> **status**: [`PurchaseStatus`](../type-aliases/PurchaseStatus.md)

***

### terminalReason?

> `optional` **terminalReason?**: `string`

Terminal reason (when terminal).

***

### updatedAt

> **updatedAt**: `number`
