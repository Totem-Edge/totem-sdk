[**@totemsdk/decision**](../index.md)

***

[@totemsdk/decision](../index.md) / DecisionRef

# Interface: DecisionRef

## Extended by

- [`DecisionRefRecord`](DecisionRefRecord.md)

## Properties

### candidateSetDigest

> `readonly` **candidateSetDigest**: `string`

***

### decisionKind

> `readonly` **decisionKind**: `"action"` \| `"questions"`

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

DecisionReceipt.receiptId — the semantic decision.

***

### requestDigest

> `readonly` **requestDigest**: `string`

***

### selected?

> `readonly` `optional` **selected?**: `object`

Optional operation/target selection, for at-a-glance correlation only.

#### operation?

> `readonly` `optional` **operation?**: `string`

#### target?

> `readonly` `optional` **target?**: `string`

***

### stateDigest

> `readonly` **stateDigest**: `string`
