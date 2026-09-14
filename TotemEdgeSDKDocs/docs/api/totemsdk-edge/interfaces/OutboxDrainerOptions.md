[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / OutboxDrainerOptions

# Interface: OutboxDrainerOptions

## Properties

### backoffBaseMs?

> `optional` **backoffBaseMs?**: `number`

Base backoff ms between attempts (default 1_000).

***

### backoffMaxMs?

> `optional` **backoffMaxMs?**: `number`

Max backoff ms (default 30_000).

***

### maxAttempts?

> `optional` **maxAttempts?**: `number`

Max delivery attempts per message (default 5). Beyond this the entry is held.

***

### onEvent?

> `optional` **onEvent?**: (`event`) => `void`

Optional event hook for observability.

#### Parameters

##### event

###### attempts

`number`

###### messageId

`string`

###### type

`"negotiation.message_sent"` \| `"negotiation.delivery_retried"`

#### Returns

`void`

***

### outbox

> **outbox**: [`OutboxStore`](OutboxStore.md)

The durable outbox store.

***

### transport

> **transport**: [`NegotiationTransport`](NegotiationTransport.md)

The transport used to deliver outbox messages.
