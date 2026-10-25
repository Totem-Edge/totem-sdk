[**@totemsdk/lookup-protocol**](../index.md)

***

[@totemsdk/lookup-protocol](../index.md) / PolicyUpdateMessage

# Interface: PolicyUpdateMessage

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

#### currentRoot

> **currentRoot**: `string`

#### manifest

> **manifest**: `Uint8Array`

#### policyEpoch

> **policyEpoch**: `number`

#### policyId

> **policyId**: `string`

#### policyVersion

> **policyVersion**: `number`

#### previousRoot?

> `optional` **previousRoot?**: `string`

***

### ticket?

> `optional` **ticket?**: [`SessionTicketRef`](SessionTicketRef.md)

RFC-032-A: node-issued session ticket (alternative to per-message `auth`).
Not used on SESSION_OPEN/TICKET/CLOSE or liveness messages.

#### Inherited from

`BaseMessage.ticket`

***

### type

> **type**: `"POLICY_UPDATE"`

#### Overrides

`BaseMessage.type`

***

### version

> **version**: `number`

#### Inherited from

`BaseMessage.version`
