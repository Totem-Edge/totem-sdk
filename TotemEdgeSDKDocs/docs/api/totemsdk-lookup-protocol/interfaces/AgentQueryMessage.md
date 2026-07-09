[**@totemsdk/lookup-protocol**](../index.md)

***

[@totemsdk/lookup-protocol](../index.md) / AgentQueryMessage

# Interface: AgentQueryMessage

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

#### capabilityName?

> `optional` **capabilityName?**: `string`

#### limit?

> `optional` **limit?**: `number`

#### maxLatencyMs?

> `optional` **maxLatencyMs?**: `number`

#### maxPricePerCall?

> `optional` **maxPricePerCall?**: `number`

#### tags?

> `optional` **tags?**: `string`[]

***

### sig?

> `optional` **sig?**: `string`

#### Inherited from

`BaseMessage.sig`

***

### type

> **type**: `"AGENT_QUERY"`

#### Overrides

`BaseMessage.type`

***

### version

> **version**: `number`

#### Inherited from

`BaseMessage.version`
