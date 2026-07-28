[**@totemsdk/lookup-protocol**](../index.md)

***

[@totemsdk/lookup-protocol](../index.md) / PolicyUpdateMessage

# Interface: PolicyUpdateMessage

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

### sig?

> `optional` **sig?**: `string`

#### Inherited from

`BaseMessage.sig`

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
