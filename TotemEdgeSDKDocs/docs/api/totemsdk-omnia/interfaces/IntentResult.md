[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / IntentResult

# Interface: IntentResult

## Properties

### channel?

> `optional` **channel?**: [`OmniaChannel`](OmniaChannel.md)

***

### idempotentReplay?

> `optional` **idempotentReplay?**: `boolean`

True when a stable operation ID was already committed.

***

### receipt?

> `optional` **receipt?**: [`AgentReceipt`](AgentReceipt.md)

***

### status

> **status**: `"approved"` \| `"pending_user"` \| `"rejected"`
