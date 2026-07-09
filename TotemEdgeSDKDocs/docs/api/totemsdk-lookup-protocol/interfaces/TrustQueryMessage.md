[**@totemsdk/lookup-protocol**](../index.md)

***

[@totemsdk/lookup-protocol](../index.md) / TrustQueryMessage

# Interface: TrustQueryMessage

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

#### subjectId

> **subjectId**: `string`

#### subjectType

> **subjectType**: `"app"` \| `"agent"` \| `"node"`

***

### sig?

> `optional` **sig?**: `string`

#### Inherited from

`BaseMessage.sig`

***

### type

> **type**: `"TRUST_QUERY"`

#### Overrides

`BaseMessage.type`

***

### version

> **version**: `number`

#### Inherited from

`BaseMessage.version`
