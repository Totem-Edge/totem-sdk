[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / PolicyEvalResult

# Interface: PolicyEvalResult

Result of evaluating a proposal against a single policy middleware layer.
Richer than a boolean — communicates why a decision was made.

## Properties

### authorityDecision?

> `optional` **authorityDecision?**: `AuthorityDecision`

Full authority decision, when an authority layer produced one.

***

### outcome

> **outcome**: `"approved"` \| `"rejected"` \| `"requires_human"`

Three-state outcome — never `pending_user` which is a wallet concern.

***

### reason

> **reason**: `string`

Human-readable explanation (shown in logs, audit trail, user UI).

***

### reservationState?

> `optional` **reservationState?**: `"new"` \| `"already_reserved"` \| `"already_committed"`

Reservation lifecycle state, when returned by a stateful policy.

***

### usageDelta?

> `optional` **usageDelta?**: `object`

Usage delta implied by the authority decision.

#### amount?

> `optional` **amount?**: `string`

#### count

> **count**: `number`
