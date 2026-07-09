[**@totemsdk/lookup-protocol**](../index.md)

***

[@totemsdk/lookup-protocol](../index.md) / AgentAnnounceMessage

# Interface: AgentAnnounceMessage

## Extends

- `BaseMessage`

## Properties

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

#### publicKey?

> `optional` **publicKey?**: `string`

Hex-encoded Ed25519 public key of the signer

#### signature?

> `optional` **signature?**: `string`

Hex-encoded Ed25519 signature over manifest bytes

#### tags?

> `optional` **tags?**: `string`[]

Capability tags for filtering (e.g. ['translation', 'gpt-4'])

***

### sig?

> `optional` **sig?**: `string`

#### Inherited from

`BaseMessage.sig`

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
