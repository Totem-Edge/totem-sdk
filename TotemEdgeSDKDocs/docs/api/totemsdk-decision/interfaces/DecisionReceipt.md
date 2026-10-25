[**@totemsdk/decision**](../index.md)

***

[@totemsdk/decision](../index.md) / DecisionReceipt

# Interface: DecisionReceipt

Unsigned advisory decision receipt (v1).

`hashes ≠ proof of neural correctness`
`DecisionReceipt ≠ cryptographic authorization ≠ signed attestation`

## Properties

### candidateSetDigest

> `readonly` **candidateSetDigest**: `string`

***

### confidence?

> `readonly` `optional` **confidence?**: `number`

***

### decisionKind

> `readonly` **decisionKind**: `"action"` \| `"questions"`

***

### durationMs?

> `readonly` `optional` **durationMs?**: `number`

***

### issuedAt

> `readonly` **issuedAt**: `number`

***

### model?

> `readonly` `optional` **model?**: [`DecisionModelRef`](DecisionModelRef.md)

***

### outputDigest

> `readonly` **outputDigest**: `string`

***

### provider

> `readonly` **provider**: [`DecisionProviderRef`](DecisionProviderRef.md)

***

### receiptId

> `readonly` **receiptId**: `string`

***

### requestDigest

> `readonly` **requestDigest**: `string`

***

### requestId

> `readonly` **requestId**: `string`

***

### runtime?

> `readonly` `optional` **runtime?**: [`DecisionRuntimeRef`](DecisionRuntimeRef.md)

***

### stateDigest

> `readonly` **stateDigest**: `string`

***

### upstreamRequestId?

> `readonly` `optional` **upstreamRequestId?**: `string`

Provider-side (upstream) request id, when reported (durable audit ref).

***

### version

> `readonly` **version**: `1`
