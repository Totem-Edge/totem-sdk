[**@totemsdk/lookup-protocol**](../index.md)

***

[@totemsdk/lookup-protocol](../index.md) / ProofResponseMessage

# Interface: ProofResponseMessage

## Extends

- `BaseMessage`

## Properties

### auth?

> `optional` **auth?**: [`WotsAuthEnvelope`](WotsAuthEnvelope.md)

RFC-032 post-quantum authentication (present on authenticated messages).

#### Inherited from

`BaseMessage.auth`

***

### id?

> `optional` **id?**: `string`

#### Inherited from

`BaseMessage.id`

***

### payload

> **payload**: `object`

#### coinId

> **coinId**: `string`

#### proof

> **proof**: `unknown`

***

### ticket?

> `optional` **ticket?**: [`SessionTicketRef`](SessionTicketRef.md)

RFC-032-A: node-issued session ticket (alternative to per-message `auth`).
Not used on SESSION_OPEN/TICKET/CLOSE or liveness messages.

#### Inherited from

`BaseMessage.ticket`

***

### type

> **type**: `"PROOF_RESPONSE"`

#### Overrides

`BaseMessage.type`

***

### version

> **version**: `number`

#### Inherited from

`BaseMessage.version`
