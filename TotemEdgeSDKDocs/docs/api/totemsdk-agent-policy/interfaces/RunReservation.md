[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / RunReservation

# Interface: RunReservation

## Properties

### abortReason?

> `optional` **abortReason?**: `string`

***

### actionDigest

> **actionDigest**: `string`

***

### decisionIds?

> `optional` **decisionIds?**: `string`[]

***

### effects?

> `optional` **effects?**: [`StepEffects`](StepEffects.md)

The authorized step effects (for run-total folding on commit).

***

### expiresAt

> **expiresAt**: `number`

***

### mandateIds?

> `optional` **mandateIds?**: `string`[]

Mandates/decisions that authorized this step.

***

### receipt?

> `optional` **receipt?**: [`RunStepReceipt`](RunStepReceipt.md)

***

### reservationId

> **reservationId**: `string`

***

### reservedAt

> **reservedAt**: `number`

***

### runId

> **runId**: `string`

***

### status

> **status**: `"reserved"` \| `"committed"` \| `"aborted"`

***

### stepAction

> **stepAction**: `string`

The action string (for transition validation across steps).

***

### stepId

> **stepId**: `string`

***

### usageDeltas?

> `optional` **usageDeltas?**: `object`[]

Per-mandate usage reserved atomically with the run-state reservation.

#### delta

> **delta**: `object`

##### delta.amount?

> `optional` **amount?**: `string`

##### delta.count

> **count**: `number`

#### mandateId

> **mandateId**: `string`
