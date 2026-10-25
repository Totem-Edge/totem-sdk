[**@totemsdk/agent-policy**](../index.md)

***

[@totemsdk/agent-policy](../index.md) / DecisionRefEvidence

# Interface: DecisionRefEvidence

RFC-017: a semantic decision reference recorded as inert run evidence. The
shape mirrors `@totemsdk/decision`'s `DecisionRefRecord` so `@totemsdk/edge`
can pass a verified ref through while agent-policy stays free of a decision
runtime dependency. A ref grants nothing and is never evaluated as policy.

## Properties

### candidateSetDigest

> `readonly` **candidateSetDigest**: `string`

***

### decisionKind

> `readonly` **decisionKind**: `"questions"` \| `"action"`

***

### issuedAt

> `readonly` **issuedAt**: `number`

***

### kind

> `readonly` **kind**: `"decision"`

***

### outputDigest

> `readonly` **outputDigest**: `string`

***

### providerId

> `readonly` **providerId**: `string`

***

### receiptId

> `readonly` **receiptId**: `string`

***

### requestDigest

> `readonly` **requestDigest**: `string`

***

### selected?

> `readonly` `optional` **selected?**: `object`

#### operation?

> `readonly` `optional` **operation?**: `string`

#### target?

> `readonly` `optional` **target?**: `string`

***

### stateDigest

> `readonly` **stateDigest**: `string`

***

### verification

> `readonly` **verification**: `"verified"` \| `"unverified"`
