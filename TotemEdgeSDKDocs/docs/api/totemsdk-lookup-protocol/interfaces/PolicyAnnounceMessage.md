[**@totemsdk/lookup-protocol**](../index.md)

***

[@totemsdk/lookup-protocol](../index.md) / PolicyAnnounceMessage

# Interface: PolicyAnnounceMessage

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

#### authorityIdentityId

> **authorityIdentityId**: `string`

#### capabilities

> **capabilities**: `string`[]

#### expiresAt

> **expiresAt**: `number`

#### manifest

> **manifest**: `Uint8Array`

#### policyEpoch

> **policyEpoch**: `number`

#### policyId

> **policyId**: `string`

#### policyRoot

> **policyRoot**: `string`

#### policyVersion

> **policyVersion**: `number`

#### retrievalEndpoints?

> `optional` **retrievalEndpoints?**: `object`[]

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

> **type**: `"POLICY_ANNOUNCE"`

#### Overrides

`BaseMessage.type`

***

### version

> **version**: `number`

#### Inherited from

`BaseMessage.version`
