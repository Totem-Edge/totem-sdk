[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / IngressResult

# Interface: IngressResult

## Properties

### claimed

> **claimed**: `boolean`

True when this caller won the atomic replay claim and must process the
message. When false, the message was already claimed/completed — take the
replay path (return the prior outcome, do not re-process).

***

### message

> **message**: [`NegotiationMessage`](../type-aliases/NegotiationMessage.md)

The authenticated message.

***

### priorEntry?

> `optional` **priorEntry?**: [`ReplayEntry`](../type-aliases/ReplayEntry.md)

Prior durable entry when replayed/completed.

***

### reclaimed?

> `optional` **reclaimed?**: `boolean`

True when a stale PROCESSING lease was reclaimed.

***

### replayed

> **replayed**: `boolean`

True when this exact message was already processed (idempotent replay).

***

### sender

> **sender**: `string`

The authenticated sender address.
