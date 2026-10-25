[**@totemsdk/lookup-protocol**](../index.md)

***

[@totemsdk/lookup-protocol](../index.md) / LeaseReserveMessage

# Interface: LeaseReserveMessage

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

#### branchId?

> `optional` **branchId?**: `string`

#### deviceId?

> `optional` **deviceId?**: `string`

#### indices?

> `optional` **indices?**: `WotsIndices`

Optional — when present, the node must reserve these exact indices
 (quorum attestation) instead of allocating the next free slot.

#### payloadHash?

> `optional` **payloadHash?**: `string`

#### purpose?

> `optional` **purpose?**: `string`

#### treeId

> **treeId**: `string`

#### ttlMs?

> `optional` **ttlMs?**: `number`

***

### ticket?

> `optional` **ticket?**: [`SessionTicketRef`](SessionTicketRef.md)

RFC-032-A: node-issued session ticket (alternative to per-message `auth`).
Not used on SESSION_OPEN/TICKET/CLOSE or liveness messages.

#### Inherited from

`BaseMessage.ticket`

***

### type

> **type**: `"LEASE_RESERVE"`

#### Overrides

`BaseMessage.type`

***

### version

> **version**: `number`

#### Inherited from

`BaseMessage.version`
