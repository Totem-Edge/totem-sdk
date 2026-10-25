[**@totemsdk/lookup-protocol**](../index.md)

***

[@totemsdk/lookup-protocol](../index.md) / AgentAnnounceMessage

# Interface: AgentAnnounceMessage

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

#### capabilityId

> **capabilityId**: `string`

#### expiresAt

> **expiresAt**: `number`

#### latencyMs?

> `optional` **latencyMs?**: `number`

Expected latency in milliseconds (for maxLatencyMs filter)

#### manifest

> **manifest**: `Uint8Array`

#### pricePerCall?

> `optional` **pricePerCall?**: `number`

Price per RPC call in smallest unit (for maxPricePerCall filter)

#### tags?

> `optional` **tags?**: `string`[]

Capability tags for filtering (e.g. ['translation', 'gpt-4'])

***

### ticket?

> `optional` **ticket?**: [`SessionTicketRef`](SessionTicketRef.md)

RFC-032-A: node-issued session ticket (alternative to per-message `auth`).
Not used on SESSION_OPEN/TICKET/CLOSE or liveness messages.

#### Inherited from

`BaseMessage.ticket`

***

### type

> **type**: `"AGENT_ANNOUNCE"`

#### Overrides

`BaseMessage.type`

***

### version

> **version**: `number`

#### Inherited from

`BaseMessage.version`
