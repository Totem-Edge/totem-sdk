[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / EdgeActionInput

# Interface: EdgeActionInput

## Properties

### action

> **action**: `string`

***

### approvalId?

> `optional` **approvalId?**: `string`

Human approval id authorizing a guarded industrial action (RFC-011 §4.9).

***

### context?

> `optional` **context?**: `Record`\<`string`, `unknown`\>

***

### deadlineAt?

> `optional` **deadlineAt?**: `number`

Absolute deadline (epoch ms) after which the action must not be prepared
(RFC-010 §6.8 temporal deadline). Evaluated against the adapter's clock.

***

### decisionId?

> `optional` **decisionId?**: `string`

Authorization decision id, when known (typically attached post-authorization).

***

### decisionRef?

> `optional` **decisionRef?**: [`DecisionRefRecord`](DecisionRefRecord.md)

RFC-017: the semantic decision that motivated this action. Inert input
context — never a capability, never fed to effect derivation, and never a
substitute for preparation, policy or authority.

***

### idempotencyKey?

> `optional` **idempotencyKey?**: `string`

RFC-019 P1-3: a stable idempotency key. Retries that reuse it map to the
same step id + nonce, so the governed runtime cannot double-reserve or
double-pay the same logical operation (the duplicate nonce is rejected).

***

### mandateProofId?

> `optional` **mandateProofId?**: `string`

Authority mandate proof that authorizes this action (RFC-010 §6.4). Carried
through to `prepare` so an industrial definition can bind it into its
commitment; not itself an authorization decision.

***

### payload?

> `optional` **payload?**: `Record`\<`string`, `unknown`\>

***

### proposalId?

> `optional` **proposalId?**: `string`

Industrial proposal id, for durable operation records (RFC-010 §6.6).

***

### subject

> **subject**: `string`
