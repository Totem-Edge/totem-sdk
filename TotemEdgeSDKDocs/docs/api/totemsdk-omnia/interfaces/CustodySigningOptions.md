[**@totemsdk/omnia**](../index.md)

***

[@totemsdk/omnia](../index.md) / CustodySigningOptions

# Interface: CustodySigningOptions

## Extends

- [`CustodyAcknowledgementOptions`](CustodyAcknowledgementOptions.md)

## Properties

### acknowledgement?

> `optional` **acknowledgement?**: [`CustodyAcknowledgement`](CustodyAcknowledgement.md)

***

### clockSkewMs?

> `optional` **clockSkewMs?**: `number`

Tolerated future clock skew for acknowledgedAt (default 5 minutes).

#### Inherited from

[`CustodyAcknowledgementOptions`](CustodyAcknowledgementOptions.md).[`clockSkewMs`](CustodyAcknowledgementOptions.md#clockskewms)

***

### now?

> `optional` **now?**: `number`

#### Inherited from

[`CustodyAcknowledgementOptions`](CustodyAcknowledgementOptions.md).[`now`](CustodyAcknowledgementOptions.md#now)

***

### policyDecision?

> `optional` **policyDecision?**: `"allow"` \| `"deny"`

Hosted custody requires a positive policy decision; absent/deny fails closed.

***

### subjectId?

> `optional` **subjectId?**: `string`

#### Inherited from

[`CustodyAcknowledgementOptions`](CustodyAcknowledgementOptions.md).[`subjectId`](CustodyAcknowledgementOptions.md#subjectid)
