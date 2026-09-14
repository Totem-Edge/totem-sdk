[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / OutboxEntry

# Interface: OutboxEntry

An outbound message awaiting delivery.

## Properties

### attempts

> **attempts**: `number`

Delivery attempt count (bounded retry budget).

***

### deliveredAt?

> `optional` **deliveredAt?**: `number`

When the message was delivered (undefined = undelivered).

***

### enqueuedAt

> **enqueuedAt**: `number`

When the entry was enqueued.

***

### message

> **message**: [`NegotiationMessage`](../type-aliases/NegotiationMessage.md)

The signed message to deliver.

***

### messageId

> **messageId**: `string`

Stable canonical message ID (recomputed, never trusted from the wire).

***

### recipient

> **recipient**: `string`

The recipient address.
