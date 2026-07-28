[**@totemsdk/lookup-protocol**](../index.md)

***

[@totemsdk/lookup-protocol](../index.md) / PolicyAnnounceMessage

# Interface: PolicyAnnounceMessage

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

#### authorityIdentityId

> **authorityIdentityId**: `string`

#### capabilities

> **capabilities**: `string`[]

#### expiresAt

> **expiresAt**: `number`

#### manifest

> **manifest**: `Uint8Array`

#### policyEpoch

> **policyEpoch**: `number`

#### policyId

> **policyId**: `string`

#### policyRoot

> **policyRoot**: `string`

#### policyVersion

> **policyVersion**: `number`

#### retrievalEndpoints?

> `optional` **retrievalEndpoints?**: `object`[]

#### subjectId

> **subjectId**: `string`

***

### sig?

> `optional` **sig?**: `string`

#### Inherited from

`BaseMessage.sig`

***

### type

> **type**: `"POLICY_ANNOUNCE"`

#### Overrides

`BaseMessage.type`

***

### version

> **version**: `number`

#### Inherited from

`BaseMessage.version`
