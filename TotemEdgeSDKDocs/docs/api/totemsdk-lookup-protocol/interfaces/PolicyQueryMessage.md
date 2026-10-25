[**@totemsdk/lookup-protocol**](../index.md)

***

[@totemsdk/lookup-protocol](../index.md) / PolicyQueryMessage

# Interface: PolicyQueryMessage

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

#### activeOnly?

> `optional` **activeOnly?**: `boolean`

#### authorityIdentityId?

> `optional` **authorityIdentityId?**: `string`

#### capability?

> `optional` **capability?**: `string`

#### limit?

> `optional` **limit?**: `number`

#### minEpoch?

> `optional` **minEpoch?**: `number`

#### minVersion?

> `optional` **minVersion?**: `number`

#### policyId?

> `optional` **policyId?**: `string`

#### policyRoot?

> `optional` **policyRoot?**: `string`

#### subjectId?

> `optional` **subjectId?**: `string`

***

### ticket?

> `optional` **ticket?**: [`SessionTicketRef`](SessionTicketRef.md)

RFC-032-A: node-issued session ticket (alternative to per-message `auth`).
Not used on SESSION_OPEN/TICKET/CLOSE or liveness messages.

#### Inherited from

`BaseMessage.ticket`

***

### type

> **type**: `"POLICY_QUERY"`

#### Overrides

`BaseMessage.type`

***

### version

> **version**: `number`

#### Inherited from

`BaseMessage.version`
