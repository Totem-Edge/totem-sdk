[**@totemsdk/edge**](../index.md)

***

[@totemsdk/edge](../index.md) / DecisionRefRecord

# Interface: DecisionRefRecord

## Extends

- [`DecisionRef`](DecisionRef.md)

## Properties

### candidateSetDigest

> `readonly` **candidateSetDigest**: `string`

#### Inherited from

[`DecisionRef`](DecisionRef.md).[`candidateSetDigest`](DecisionRef.md#candidatesetdigest)

***

### decisionKind

> `readonly` **decisionKind**: `"questions"` \| `"action"`

#### Inherited from

[`DecisionRef`](DecisionRef.md).[`decisionKind`](DecisionRef.md#decisionkind)

***

### issuedAt

> `readonly` **issuedAt**: `number`

#### Inherited from

[`DecisionRef`](DecisionRef.md).[`issuedAt`](DecisionRef.md#issuedat)

***

### kind

> `readonly` **kind**: `"decision"`

#### Inherited from

[`DecisionRef`](DecisionRef.md).[`kind`](DecisionRef.md#kind)

***

### outputDigest

> `readonly` **outputDigest**: `string`

#### Inherited from

[`DecisionRef`](DecisionRef.md).[`outputDigest`](DecisionRef.md#outputdigest)

***

### providerId

> `readonly` **providerId**: `string`

#### Inherited from

[`DecisionRef`](DecisionRef.md).[`providerId`](DecisionRef.md#providerid)

***

### receiptId

> `readonly` **receiptId**: `string`

DecisionReceipt.receiptId — the semantic decision.

#### Inherited from

[`DecisionRef`](DecisionRef.md).[`receiptId`](DecisionRef.md#receiptid)

***

### requestDigest

> `readonly` **requestDigest**: `string`

#### Inherited from

[`DecisionRef`](DecisionRef.md).[`requestDigest`](DecisionRef.md#requestdigest)

***

### selected?

> `readonly` `optional` **selected?**: `object`

Optional operation/target selection, for at-a-glance correlation only.

#### operation?

> `readonly` `optional` **operation?**: `string`

#### target?

> `readonly` `optional` **target?**: `string`

#### Inherited from

[`DecisionRef`](DecisionRef.md).[`selected`](DecisionRef.md#selected)

***

### stateDigest

> `readonly` **stateDigest**: `string`

#### Inherited from

[`DecisionRef`](DecisionRef.md).[`stateDigest`](DecisionRef.md#statedigest)

***

### verification

> `readonly` **verification**: `"verified"` \| `"unverified"`

'verified' only when checked against the DecisionReceipt.
