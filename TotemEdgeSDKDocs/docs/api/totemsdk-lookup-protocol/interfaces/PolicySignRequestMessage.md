[**@totemsdk/lookup-protocol**](../index.md)

***

[@totemsdk/lookup-protocol](../index.md) / PolicySignRequestMessage

# Interface: PolicySignRequestMessage

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

#### request

> **request**: `Uint8Array`

***

### ticket?

> `optional` **ticket?**: [`SessionTicketRef`](SessionTicketRef.md)

RFC-032-A: node-issued session ticket (alternative to per-message `auth`).
Not used on SESSION_OPEN/TICKET/CLOSE or liveness messages.

#### Inherited from

`BaseMessage.ticket`

***

### type

> **type**: `"POLICY_SIGN_REQUEST"`

#### Overrides

`BaseMessage.type`

***

### version

> **version**: `number`

#### Inherited from

`BaseMessage.version`
