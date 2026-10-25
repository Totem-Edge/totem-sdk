[**@totemsdk/lookup-protocol**](../index.md)

***

[@totemsdk/lookup-protocol](../index.md) / TrustRecordMessage

# Interface: TrustRecordMessage

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

#### comment?

> `optional` **comment?**: `string`

#### rating

> **rating**: `number`

#### reviewerAddress

> **reviewerAddress**: `string`

#### reviewerPublicKey?

> `optional` **reviewerPublicKey?**: `string`

Hex WOTS PKdigest of the reviewer, when supplied (else derived via session).

#### signature

> **signature**: `string`

Hex WOTS signature over the canonical review payload (RFC-032).

#### subjectId

> **subjectId**: `string`

***

### ticket?

> `optional` **ticket?**: [`SessionTicketRef`](SessionTicketRef.md)

RFC-032-A: node-issued session ticket (alternative to per-message `auth`).
Not used on SESSION_OPEN/TICKET/CLOSE or liveness messages.

#### Inherited from

`BaseMessage.ticket`

***

### type

> **type**: `"TRUST_RECORD"`

#### Overrides

`BaseMessage.type`

***

### version

> **version**: `number`

#### Inherited from

`BaseMessage.version`
