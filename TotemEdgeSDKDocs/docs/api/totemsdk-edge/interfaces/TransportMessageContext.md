[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / TransportMessageContext

# Interface: TransportMessageContext

Context passed to the transport handler for an inbound message.

## Properties

### metadata?

> `optional` **metadata?**: `Record`\<`string`, `unknown`\>

Transport-level metadata (e.g. topic, connection id).

***

### recipient

> **recipient**: `string`

The local recipient address.

***

### sender

> **sender**: `string`

The authenticated sender address (resolved by the transport).
