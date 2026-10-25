[**@totemsdk/lookup-protocol**](../index.md)

***

[@totemsdk/lookup-protocol](../index.md) / AppAnnounceMessage

# Interface: AppAnnounceMessage

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

#### appId

> **appId**: `string`

#### authorAddress?

> `optional` **authorAddress?**: `string`

Minima address of the app author — stored as a filterable column for APP_QUERY.
Authoritative source is inside the manifest; this top-level field enables
discovery before a full AppManifest parser is available.

#### expiresAt

> **expiresAt**: `number`

#### isFree?

> `optional` **isFree?**: `boolean`

If true the app charges no fees — used for freeOnly filter in APP_QUERY.

#### manifest

> **manifest**: `Uint8Array`

***

### ticket?

> `optional` **ticket?**: [`SessionTicketRef`](SessionTicketRef.md)

RFC-032-A: node-issued session ticket (alternative to per-message `auth`).
Not used on SESSION_OPEN/TICKET/CLOSE or liveness messages.

#### Inherited from

`BaseMessage.ticket`

***

### type

> **type**: `"APP_ANNOUNCE"`

#### Overrides

`BaseMessage.type`

***

### version

> **version**: `number`

#### Inherited from

`BaseMessage.version`
