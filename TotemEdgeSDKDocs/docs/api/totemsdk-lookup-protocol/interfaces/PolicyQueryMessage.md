[**@totemsdk/lookup-protocol**](../index.md)

***

[@totemsdk/lookup-protocol](../index.md) / PolicyQueryMessage

# Interface: PolicyQueryMessage

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

### sig?

> `optional` **sig?**: `string`

#### Inherited from

`BaseMessage.sig`

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
